'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export interface UseRAGBotOptions {
  welcomeMessage?: string;
  maxHistory?: number;
}

export interface UseRAGBotReturn {
  messages: WidgetMessage[];
  isOpen: boolean;
  isStreaming: boolean;
  input: string;
  error: string | null;
  setInput: (value: string) => void;
  setIsOpen: (value: boolean) => void;
  sendMessage: () => Promise<void>;
  cancelStreaming: () => void;
  clearMessages: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract text content from an SSE line using multiple format parsers.
 * Handles:
 * 1. Vercel AI SDK text stream: "0:\"hello\"" -> hello
 * 2. Vercel AI SDK (no quotes): "0:hello" -> hello
 * 3. Standard SSE: "data: hello" -> hello
 * 4. Raw text (no prefix): "hello" -> hello
 */
function extractTextFromStreamLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Skip SSE comments and control lines
  if (trimmed.startsWith(':') || trimmed === '') return null;

  // --- Format 1: Vercel AI SDK text stream (0:"text") ---
  if (trimmed.startsWith('0:')) {
    const payload = trimmed.slice(2).trim();
    if (!payload) return '';

    // Try to parse as JSON string literal (e.g., "hello\nworld")
    if (payload.startsWith('"') && payload.endsWith('"')) {
      try {
        // Use JSON.parse to properly unescape \\n, \\t, etc.
        return JSON.parse(payload) as string;
      } catch {
        // JSON parse failed, fall through to raw extraction
      }
    }
    // If not wrapped in quotes, or JSON parse failed, return raw payload
    return payload;
  }

  // --- Format 2: Standard SSE data: prefix ---
  if (trimmed.startsWith('data:')) {
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') return null; // Stream end marker
    if (!payload) return '';

    // Try JSON parse first (e.g., data: {"content":"hello"})
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed === 'object' && 'content' in parsed) {
        return String((parsed as { content: unknown }).content ?? '');
      }
    } catch {
      // Not JSON, return raw
    }
    return payload;
  }

  // --- Format 3: Raw text line (no known prefix) ---
  // Only accept if it's not a control line and looks like content
  return trimmed;
}

// =============================================================================
// Hook
// =============================================================================

export function useRAGBot(options: UseRAGBotOptions = {}): UseRAGBotReturn {
  const { maxHistory = 10 } = options;

  const [messages, setMessages] = useState<WidgetMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('rag-bot-messages');
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetMessage[];
        return parsed;
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef('');

  // Persist messages to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('rag-bot-messages', JSON.stringify(messages));
    }
  }, [messages]);

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rag-bot-messages');
    }
  }, []);

  const buildHistory = useCallback(
    (currentMessages: WidgetMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> => {
      return currentMessages
        .filter((m) => !m.isStreaming && m.content)
        .slice(-maxHistory)
        .map((m) => ({ role: m.role, content: m.content }));
    },
    [maxHistory]
  );

  const sendMessage = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setError(null);
    setInput('');

    // Add user message
    const userMsg: WidgetMessage = {
      id: generateId(),
      role: 'user',
      content: question,
    };

    // Add placeholder assistant message
    const assistantId = generateId();
    const assistantMsg: WidgetMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    const updatedMessages = [...messages, userMsg, assistantMsg];
    setMessages(updatedMessages);
    setIsStreaming(true);
    streamingContentRef.current = '';

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          history: buildHistory(updatedMessages),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMessage = 'Something went wrong';
        try {
          const errorData = (await response.json()) as { error?: string; code?: string };
          errorMessage = errorData.error || errorMessage;
          if (response.status === 401) {
            errorMessage = errorMessage || 'Please sign in to chat with RAG Bot';
          }
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Check if response is actually a stream or plain text/JSON
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      // If it's a plain JSON response (non-streaming fallback), handle it directly
      if (isJson && !response.body) {
        const data = (await response.json()) as {
          data?: { answer?: string; content?: string };
          text?: string;
        };
        const text = data.data?.answer || data.data?.content || data.text || 'No response';
        streamingContentRef.current = text;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: text, isStreaming: false } : m))
        );
        setIsStreaming(false);
        return;
      }

      // Handle SSE/text streaming
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedAnyContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const text = extractTextFromStreamLine(line);
          if (text !== null) {
            receivedAnyContent = true;
            streamingContentRef.current += text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: streamingContentRef.current } : m
              )
            );
          }
        }
      }

      // Process remaining buffer after stream ends
      const remainingText = extractTextFromStreamLine(buffer);
      if (remainingText !== null) {
        receivedAnyContent = true;
        streamingContentRef.current += remainingText;
      }

      // If we received no content at all, the stream might be in a different format
      if (!receivedAnyContent && !streamingContentRef.current) {
        streamingContentRef.current = "I'm having trouble reading the response. Please try again.";
      }

      // Mark streaming complete with final content
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: streamingContentRef.current, isStreaming: false }
            : m
        )
      );

      setIsStreaming(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: streamingContentRef.current || 'Cancelled', isStreaming: false }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      setIsStreaming(false);

      // Remove empty assistant message on error, or show error in the bubble
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === assistantId && !last.content) {
          return prev.slice(0, -1);
        }
        return prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: m.content || 'Sorry, I encountered an error. Please try again.',
                isStreaming: false,
              }
            : m
        );
      });
    } finally {
      abortControllerRef.current = null;
    }
  }, [input, isStreaming, messages, buildHistory]);

  return {
    messages,
    isOpen,
    isStreaming,
    input,
    error,
    setInput,
    setIsOpen,
    sendMessage,
    cancelStreaming,
    clearMessages,
  };
}
