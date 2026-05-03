'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Source } from '@/components/chat/citations';
import type { Message } from '@/components/chat/message-item';
import { getAllProviderKeys } from '@/hooks/use-provider-keys';

export interface UseChatOptions {
  conversationId?: string;
  agentMode?: boolean;
  model?: string;
  onError?: (error: Error) => void;
  onFinish?: (message: Message) => void;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
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
  sendMessage: (content: string, files?: File[], chatIdOverride?: string) => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  deleteMessage: (id: string) => void;
  editMessage: (id: string, newContent: string) => void;
  loadMessages: (chatId: string, pageNum?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  fetchConversations: (limit?: number) => Promise<ConversationSummary[]>;
  clearMessages: () => void;
}

// Max retry attempts for recoverable errors
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Parse error from API response and generate a user-friendly message
 */
async function parseApiError(response: Response): Promise<Error> {
  let errorMessage = 'An unexpected error occurred';
  let errorCode = 'UNKNOWN';

  try {
    const data = await response.json();
    errorCode = data.code || data.error?.code || 'UNKNOWN';
    errorMessage = data.details || data.error?.message || data.error || errorMessage;
  } catch {
    // Response body wasn't JSON
    errorMessage = response.statusText || errorMessage;
  }

  switch (response.status) {
    case 401:
      errorMessage = 'Session expired. Please sign in again.';
      break;
    case 403:
      errorMessage = "You don't have permission to access this chat.";
      break;
    case 404:
      errorMessage = 'Chat not found. It may have been deleted.';
      break;
    case 429: {
      const retryAfter = response.headers.get('Retry-After');
      errorMessage = retryAfter
        ? `Rate limit exceeded. Try again in ${retryAfter} seconds.`
        : 'Too many requests. Please slow down.';
      break;
    }
    case 400:
      if (errorCode === 'TOKEN_LIMIT') {
        errorMessage = 'Message too long. Try shortening your input.';
      } else if (errorCode === 'VALIDATION_ERROR') {
        errorMessage = `Invalid input: ${errorMessage}`;
      }
      break;
    case 503:
      errorMessage = 'The AI model is temporarily unavailable. Trying a fallback...';
      break;
    case 500:
      errorMessage = `Server error: ${errorMessage}`;
      break;
  }

  const error = new Error(errorMessage);
  (error as Error & { status: number; code: string }).status = response.status;
  (error as Error & { status: number; code: string }).code = errorCode;
  return error;
}

/**
 * Check if an error is retryable (network failures, 503, 502)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true; // Network error
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    return status === 502 || status === 503 || status === 504;
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { conversationId, agentMode, model, onError, onFinish } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const abortControllerRef = useRef<AbortController | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  // Load messages for a specific chat ID — called explicitly by the parent, NOT via useEffect
  const loadMessages = useCallback(async (chatId: string, pageNum = 1) => {
    if (!chatId) return;

    try {
      const response = await fetch(`/api/chat?chatId=${chatId}&limit=50`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      if (conversationIdRef.current !== chatId) return;

      if (data.success && data.data?.messages) {
        const loadedMessages: Message[] = data.data.messages.map(
          (m: {
            id: string;
            role: string;
            content: string;
            createdAt: string;
            sources?: Source[];
          }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: new Date(m.createdAt),
            sources: m.sources,
          })
        );

        if (pageNum === 1) {
          setMessages((prev) => {
            // Avoid race: mount GET returns [] before POST has persisted the first user message,
            // which would wipe the optimistic bubble and snap back to the welcome screen.
            if (loadedMessages.length === 0 && prev.some((m) => m.id.startsWith('temp-user-'))) {
              return prev;
            }
            return loadedMessages;
          });
        } else {
          setMessages((prev) => [...loadedMessages, ...prev]);
        }

        setHasMore(data.data.messages.length >= 50);
        setPage(pageNum);
      }
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
    }
  }, []);

  // Explicit clear function for callers (e.g. handleNewChat)
  const clearMessages = useCallback(() => {
    setMessages([]);
    setSources([]);
    setError(null);
    setStreamingContent('');
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  // Clear messages whenever the conversation ID changes (skip initial mount)
  const prevConversationIdRef = useRef<string | undefined>(conversationId);
  useEffect(() => {
    const prev = prevConversationIdRef.current;
    if (conversationId === prev) return;

    // First time we bind a real chat id (e.g. user clicked "Start chat" or auto-created
    // a session), the parent already called clearMessages() and messages are empty.
    // Clearing again here can race with submit: sendMessage's optimistic update may run
    // before this effect and then get wiped, so the UI looks broken and streaming fails.
    const skipClearBecauseFirstId = prev === undefined && conversationId !== undefined;

    prevConversationIdRef.current = conversationId;

    if (skipClearBecauseFirstId) return;

    setMessages([]);
    setSources([]);
    setError(null);
    setStreamingContent('');
    setIsStreaming(false);
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !conversationIdRef.current) return;
    await loadMessages(conversationIdRef.current, page + 1);
  }, [hasMore, isLoading, page, loadMessages]);

  /**
   * Core send message function with streaming support and retry logic
   */
  const sendMessage = useCallback(
    async (content: string, _files?: File[], chatIdOverride?: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) return;

      // Input validation
      if (trimmedContent.length > 100000) {
        const err = new Error('Message is too long. Please shorten your input.');
        setError(err);
        toast.error(err.message);
        onErrorRef.current?.(err);
        return;
      }

      setError(null);
      setIsLoading(true);

      // Create optimistic user message
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: trimmedContent,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');

      let retryCount = 0;

      const attemptSend = async (): Promise<void> => {
        try {
          setIsStreaming(true);
          setStreamingContent('');

          abortControllerRef.current = new AbortController();

          // Use agent endpoint when agent mode is enabled
          const endpoint = agentMode ? '/api/chat/agent' : '/api/chat';

          // Build headers with custom provider keys from localStorage
          const providerKeys = getAllProviderKeys();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (providerKeys.openrouter) headers['x-key-openrouter'] = providerKeys.openrouter;
          if (providerKeys.fireworks) headers['x-key-fireworks'] = providerKeys.fireworks;

          const effectiveChatId = chatIdOverride || conversationIdRef.current;

          const response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({
              messages: [{ role: 'user', content: trimmedContent }],
              conversationId: effectiveChatId,
              config: {
                model: modelRef.current || 'arcee-ai/trinity-large-preview:free',
              },
              stream: true,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const apiError = await parseApiError(response);

            // Check if retryable
            if (isRetryableError(apiError) && retryCount < MAX_RETRIES) {
              retryCount++;
              toast.info(`Connection issue. Retrying (${retryCount}/${MAX_RETRIES})...`);
              await sleep(RETRY_DELAY_MS * retryCount);
              return attemptSend();
            }

            throw apiError;
          }

          // Parse sources from response headers
          const sourcesHeader = response.headers.get('X-Message-Sources');
          if (sourcesHeader) {
            try {
              const parsedSources = JSON.parse(sourcesHeader);
              if (Array.isArray(parsedSources) && parsedSources.length > 0) {
                setSources(
                  parsedSources.map(
                    (
                      s: {
                        id: string;
                        documentName: string;
                        documentId: string;
                        page?: number;
                        similarity: number;
                      },
                      idx: number
                    ) => ({
                      id: s.id,
                      index: idx + 1,
                      documentName: s.documentName,
                      documentType: 'document',
                      chunkText: '',
                      pageNumber: s.page,
                      relevanceScore: s.similarity,
                    })
                  )
                );
              }
            } catch {
              // Ignore header parse errors
            }
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error(
              'Server returned an empty response. Check that your AI provider API key (OpenRouter, Fireworks) is configured.'
            );
          }

          let fullContent = '';
          const decoder = new TextDecoder();
          const contentType = response.headers.get('content-type') ?? '';
          const isEventStream = contentType.includes('text/event-stream');

          // AI SDK streamText().toTextStreamResponse() uses text/plain with raw UTF-8 chunks.
          if (!isEventStream) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              fullContent += decoder.decode(value, { stream: true });
              setStreamingContent(fullContent);
            }
            fullContent += decoder.decode();
          } else {
            // Legacy / alternate: newline-delimited data stream (type:payload)
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (!line.trim()) continue;

                if (line.startsWith('0:')) {
                  try {
                    const textDelta = JSON.parse(line.slice(2));
                    if (typeof textDelta === 'string') {
                      fullContent += textDelta;
                      setStreamingContent(fullContent);
                    }
                  } catch {
                    fullContent += line.slice(2);
                    setStreamingContent(fullContent);
                  }
                } else if (line.startsWith('e:')) {
                  try {
                    const errorData = JSON.parse(line.slice(2));
                    throw new Error(errorData.message || 'Stream error from server');
                  } catch (e) {
                    if (e instanceof Error && e.message !== 'Stream error from server') {
                      // JSON parse error, ignore
                    } else {
                      throw e;
                    }
                  }
                } else if (line.startsWith('d:') || line.startsWith('f:')) {
                  // done
                } else {
                  fullContent += line;
                  setStreamingContent(fullContent);
                }
              }
            }
          }

          // Stream completed — create the final assistant message
          if (fullContent.trim()) {
            const assistantMessage: Message = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: fullContent,
              createdAt: new Date(),
              model: response.headers.get('X-Model-Used') || modelRef.current,
            };

            setMessages((prev) => {
              // Replace temp user message with persisted version and add assistant message
              const updated = prev.map((m) => (m.id === userMessage.id ? { ...m } : m));
              return [...updated, assistantMessage];
            });

            onFinishRef.current?.(assistantMessage);
          } else {
            // Stream ended with no content — likely a model provider error
            throw new Error(
              'The AI model returned no response. Verify your API key is valid and has remaining quota.'
            );
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // User cancelled — keep the streaming content as a partial message
            return;
          }

          // Check for network errors that can be retried
          if (isRetryableError(err) && retryCount < MAX_RETRIES) {
            retryCount++;
            toast.info(`Connection issue. Retrying (${retryCount}/${MAX_RETRIES})...`);
            await sleep(RETRY_DELAY_MS * retryCount);
            return attemptSend();
          }

          const messageError = err instanceof Error ? err : new Error(String(err));
          setError(messageError);

          // Show specific toast based on error type
          if ('status' in messageError) {
            const status = (messageError as Error & { status: number }).status;
            if (status === 429) {
              toast.error(messageError.message, { duration: 8000 });
            } else if (status === 401) {
              toast.error(messageError.message, {
                action: {
                  label: 'Sign In',
                  onClick: () => (window.location.href = '/auth/signin'),
                },
              });
            } else {
              toast.error(messageError.message);
            }
          } else {
            toast.error(
              `Request failed: ${messageError.message || 'Unknown error'}. Check the browser console (F12) for details.`,
              { duration: 8000 }
            );
          }

          onErrorRef.current?.(messageError);

          // Remove optimistic user message on error
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        } finally {
          setIsLoading(false);
          setIsStreaming(false);
          setStreamingContent('');
          abortControllerRef.current = null;
        }
      };

      await attemptSend();
    },
    [agentMode]
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);

    // If we have streaming content, keep it as a partial message
    if (streamingContent.trim()) {
      const partialMessage: Message = {
        id: `msg-partial-${Date.now()}`,
        role: 'assistant',
        content: `${streamingContent}\n\n*[Generation stopped]*`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, partialMessage]);
      setStreamingContent('');
    }
  }, [streamingContent]);

  const reload = useCallback(async () => {
    // Retry last message
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === 'user');

    if (lastUserMessage) {
      // Remove last assistant message if exists
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (prev[lastIndex]?.role === 'assistant') {
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
      // Find the message index
      const messageIndex = messages.findIndex((m) => m.id === id);
      if (messageIndex === -1) return;

      // Remove all messages after the edited one
      setMessages((prev) => {
        const truncated = prev.slice(0, messageIndex);
        return [...truncated, { ...prev[messageIndex], content: newContent }];
      });

      // Re-send with the new content
      await sendMessage(newContent);
    },
    [messages, sendMessage]
  );

  const fetchConversations = useCallback(async (limit = 50): Promise<ConversationSummary[]> => {
    try {
      const response = await fetch(`/api/v1/chats?limit=${limit}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch conversations');

      const data = await response.json();
      return (data.data || []) as ConversationSummary[];
    } catch {
      return [];
    }
  }, []);

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
    loadMessages,
    loadMore,
    hasMore,
    fetchConversations,
    clearMessages,
  };
}
