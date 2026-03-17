"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { type Message } from "@/components/chat/message-item";
import { type Source } from "@/components/chat/citations";

export interface UseChatOptions {
  conversationId?: string;
  onError?: (error: Error) => void;
  onFinish?: (message: Message) => void;
}

export interface UseChatReturn {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: Error | null;
  sources: Source[];
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  deleteMessage: (id: string) => void;
  editMessage: (id: string, newContent: string) => void;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { conversationId, onError, onFinish } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load initial messages
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    }
  }, [conversationId]);

  const loadMessages = async (pageNum = 1) => {
    if (!conversationId) return;

    try {
      const response = await fetch(
        `/api/chat/${conversationId}/messages?page=${pageNum}`
      );
      if (!response.ok) throw new Error("Failed to load messages");

      const data = await response.json();

      if (pageNum === 1) {
        setMessages(data.messages);
      } else {
        setMessages((prev) => [...data.messages, ...prev]);
      }

      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoading) return;
    await loadMessages(page + 1);
  };

  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (!content.trim() && (!files || files.length === 0)) return;

      setError(null);
      setIsLoading(true);

      // Create optimistic user message
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      try {
        // Upload files if any
        let fileUrls: string[] = [];
        if (files && files.length > 0) {
          fileUrls = await uploadFiles(files);
        }

        // Start streaming
        setIsStreaming(true);
        setStreamingContent("");

        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            conversationId,
            files: fileUrls,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        let fullContent = "";
        const decoder = new TextDecoder();

        // Read stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);

              if (data.type === "token") {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === "sources") {
                setSources(data.sources);
              } else if (data.type === "error") {
                throw new Error(data.message);
              } else if (data.type === "done") {
                // Final message received
                const assistantMessage: Message = {
                  id: data.messageId || `msg-${Date.now()}`,
                  role: "assistant",
                  content: fullContent,
                  createdAt: new Date(),
                  sources: data.sources,
                  model: data.model,
                };

                setMessages((prev) => [
                  ...prev.filter((m) => m.id !== userMessage.id),
                  { ...userMessage, id: data.userMessageId || userMessage.id },
                  assistantMessage,
                ]);

                onFinish?.(assistantMessage);
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON lines
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);

        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        setStreamingContent("");
        abortControllerRef.current = null;
      }
    },
    [conversationId, onError, onFinish]
  );

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Failed to upload ${file.name}`);

      const data = await response.json();
      urls.push(data.url);
    }

    return urls;
  };

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reload = useCallback(async () => {
    // Retry last message
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");

    if (lastUserMessage) {
      // Remove last assistant message if exists
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (prev[lastIndex]?.role === "assistant") {
          return prev.slice(0, lastIndex);
        }
        return prev;
      });

      await sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  const deleteMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const editMessage = useCallback(
    async (id: string, newContent: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: newContent } : m))
      );

      // Find and delete all messages after this one, then resend
      const messageIndex = messages.findIndex((m) => m.id === id);
      if (messageIndex !== -1) {
        setMessages((prev) => prev.slice(0, messageIndex + 1));
        await sendMessage(newContent);
      }
    },
    [messages, sendMessage]
  );

  return {
    messages,
    input,
    setInput,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    sources,
    sendMessage,
    reload,
    stop,
    deleteMessage,
    editMessage,
    loadMore,
    hasMore,
  };
}
