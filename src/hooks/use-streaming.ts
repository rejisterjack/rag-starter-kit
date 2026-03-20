'use client';

import { useCallback, useRef, useState } from 'react';
import type { Source } from '@/components/chat/citations';

export interface StreamingState {
  content: string;
  isStreaming: boolean;
  sources: Source[];
  error: Error | null;
}

export interface UseStreamingOptions {
  onToken?: (token: string) => void;
  onSources?: (sources: Source[]) => void;
  onError?: (error: Error) => void;
  onFinish?: (content: string, sources: Source[]) => void;
}

export interface UseStreamingReturn {
  content: string;
  isStreaming: boolean;
  sources: Source[];
  error: Error | null;
  startStream: (response: Response) => Promise<void>;
  stopStream: () => void;
  reset: () => void;
}

/**
 * Hook for handling streaming responses from the AI API
 * Supports token-by-token accumulation, source extraction, and cancellation
 */
export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const { onToken, onSources, onError, onFinish } = options;

  const [state, setState] = useState<StreamingState>({
    content: '',
    isStreaming: false,
    sources: [],
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef('');
  const accumulatedSourcesRef = useRef<Source[]>([]);

  const startStream = useCallback(
    async (response: Response) => {
      if (!response.body) {
        throw new Error('No response body');
      }

      // Reset state
      setState({
        content: '',
        isStreaming: true,
        sources: [],
        error: null,
      });
      accumulatedContentRef.current = '';
      accumulatedSourcesRef.current = [];

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      abortControllerRef.current = new AbortController();

      try {
        while (true) {
          // Check if cancelled
          if (abortControllerRef.current.signal.aborted) {
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              switch (data.type) {
                case 'token':
                  accumulatedContentRef.current += data.content;
                  setState((prev) => ({
                    ...prev,
                    content: accumulatedContentRef.current,
                  }));
                  onToken?.(data.content);
                  break;

                case 'sources':
                  accumulatedSourcesRef.current = data.sources;
                  setState((prev) => ({
                    ...prev,
                    sources: data.sources,
                  }));
                  onSources?.(data.sources);
                  break;

                case 'error':
                  throw new Error(data.message || 'Streaming error');

                case 'done':
                  setState((prev) => ({
                    ...prev,
                    isStreaming: false,
                  }));
                  onFinish?.(accumulatedContentRef.current, accumulatedSourcesRef.current);
                  break;
              }
            } catch {
              // Ignore lines that aren't valid JSON
              // These might be SSE comments or keep-alive messages
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User cancelled - not an error
          return;
        }

        const streamError = err instanceof Error ? err : new Error(String(err));
        setState((prev) => ({
          ...prev,
          error: streamError,
          isStreaming: false,
        }));
        onError?.(streamError);
      } finally {
        reader.releaseLock();
      }
    },
    [onToken, onSources, onError, onFinish]
  );

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      content: '',
      isStreaming: false,
      sources: [],
      error: null,
    });
    accumulatedContentRef.current = '';
    accumulatedSourcesRef.current = [];
  }, []);

  return {
    content: state.content,
    isStreaming: state.isStreaming,
    sources: state.sources,
    error: state.error,
    startStream,
    stopStream,
    reset,
  };
}

/**
 * Utility function to create a streaming fetch request
 * Returns a Response that can be passed to useStreaming
 */
export async function createStreamingRequest(
  url: string,
  body: unknown,
  options?: { headers?: Record<string, string> }
): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to start stream');
  }

  return response;
}

/**
 * Parse SSE (Server-Sent Events) stream data
 */
export function parseSSEData(line: string): { type: string; data: unknown } | null {
  if (!line.startsWith('data: ')) return null;

  const data = line.slice(6);
  if (data === '[DONE]') {
    return { type: 'done', data: null };
  }

  try {
    return { type: 'data', data: JSON.parse(data) };
  } catch {
    return { type: 'raw', data };
  }
}
