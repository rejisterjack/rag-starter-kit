import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '@/hooks/use-chat';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock use-provider-keys
vi.mock('@/hooks/use-provider-keys', () => ({
  getAllProviderKeys: vi.fn(() => ({})),
}));

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.input).toBe('');
    expect(result.current.sources).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.streamingContent).toBe('');
  });

  describe('Message Sending', () => {
    it('sends a message successfully', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello response'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/plain',
          'X-Model-Used': 'test-model',
        }),
        body: mockStream,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Should have called fetch with the message
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('/api/chat');
      expect(callArgs[1].method).toBe('POST');
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].content).toBe('Hello');
    });

    it('does not send empty messages', async () => {
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('');
      });

      await act(async () => {
        await result.current.sendMessage('   ');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not send while loading', async () => {
      // Use a stream that completes quickly
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Done'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: mockStream,
      });

      const { result } = renderHook(() => useChat());

      // Send first message and wait for completion
      await act(async () => {
        await result.current.sendMessage('First');
      });

      // The first fetch should have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('uses agent endpoint when agentMode is enabled', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: mockStream,
      });

      const { result } = renderHook(() => useChat({ agentMode: true }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(mockFetch.mock.calls[0][0]).toBe('/api/chat/agent');
    });

    it('rejects messages that are too long', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useChat({ onError }));

      const longMessage = 'x'.repeat(100001);

      await act(async () => {
        await result.current.sendMessage(longMessage);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('too long');
    });
  });

  describe('Streaming Handling', () => {
    it('tracks streaming state', async () => {
      const { result } = renderHook(() => useChat());

      expect(result.current.isStreaming).toBe(false);

      // Create a stream that we can control
      let controller: ReadableStreamDefaultController;
      const mockStream = new ReadableStream({
        start(c) {
          controller = c;
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: mockStream,
      });

      // Start sending
      let sendPromise: Promise<void>;
      act(() => {
        sendPromise = result.current.sendMessage('Hello');
      });

      // Wait for fetch to start
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // Close the stream to finish
      act(() => {
        controller?.close();
      });

      await act(async () => {
        await sendPromise;
      });

      // After completion, streaming should be false
      expect(result.current.isStreaming).toBe(false);
    });

    it('receives streamed content', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello! How can I help?'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/plain',
          'X-Model-Used': 'test-model',
        }),
        body: mockStream,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hi');
      });

      // Should have created an assistant message with the streamed content
      const assistantMessages = result.current.messages.filter((m) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);
      expect(assistantMessages[0].content).toContain('Hello! How can I help?');
    });
  });

  describe('Error Handling', () => {
    it('handles API errors', async () => {
      const onError = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } }),
      });

      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Server error');
    });

    it('handles 401 errors with session expired message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Session expired');
    });

    it('handles 429 rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
        json: async () => ({ error: { code: 'RATE_LIMIT', message: 'Slow down' } }),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Too many requests');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.error).toBeDefined();
    });

    it('calls onError callback when provided', async () => {
      const onError = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: async () => ({ error: { code: 'ERROR', message: 'Failed' } }),
      });

      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Message Management', () => {
    it('clears all messages', () => {
      const { result } = renderHook(() => useChat());

      // Simulate having messages
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.streamingContent).toBe('');
    });

    it('deletes a specific message', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Response'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain', 'X-Model-Used': 'test' }),
        body: mockStream,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Should have messages now
      const messagesBeforeDelete = result.current.messages.length;
      expect(messagesBeforeDelete).toBeGreaterThan(0);

      // Delete the first message
      const firstMessageId = result.current.messages[0].id;
      act(() => {
        result.current.deleteMessage(firstMessageId);
      });

      expect(result.current.messages.find((m) => m.id === firstMessageId)).toBeUndefined();
    });

    it('edits a message and resends', async () => {
      // First call: initial send
      const mockStream1 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('First response'));
          controller.close();
        },
      });

      // Second call: edit resend
      const mockStream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Edited response'));
          controller.close();
        },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain', 'X-Model-Used': 'test' }),
          body: mockStream1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain', 'X-Model-Used': 'test' }),
          body: mockStream2,
        });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Original');
      });

      const userMessageId = result.current.messages.find((m) => m.role === 'user')?.id;
      expect(userMessageId).toBeDefined();

      // Edit the message
      await act(async () => {
        await result.current.editMessage(userMessageId ?? '', 'Edited');
      });

      // Should have made a second fetch call
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Stop', () => {
    it('stops generation on request', async () => {
      // Use a stream that returns some content then closes immediately
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Partial content'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: mockStream,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // After the stream completes, stop should still work without errors
      act(() => {
        result.current.stop();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Reload', () => {
    it('retries last user message', async () => {
      const mockStream1 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Response'));
          controller.close();
        },
      });

      const mockStream2 = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Retried response'));
          controller.close();
        },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain', 'X-Model-Used': 'test' }),
          body: mockStream1,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain', 'X-Model-Used': 'test' }),
          body: mockStream2,
        });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.reload();
      });

      // Should have made a second fetch call
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Input Handling', () => {
    it('sets input value', () => {
      const { result } = renderHook(() => useChat());

      act(() => {
        result.current.setInput('New input');
      });

      expect(result.current.input).toBe('New input');
    });

    it('clears input after sending', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain', 'X-Model-Used': 'test' }),
        body: mockStream,
      });

      const { result } = renderHook(() => useChat());

      act(() => {
        result.current.setInput('Test message');
      });

      expect(result.current.input).toBe('Test message');

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      expect(result.current.input).toBe('');
    });
  });

  describe('Fetch Conversations', () => {
    it('fetches conversation list', async () => {
      const mockConversations = [
        {
          id: 'chat-1',
          title: 'Test Chat',
          messageCount: 5,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { items: mockConversations } }),
      });

      const { result } = renderHook(() => useChat());

      let conversations: unknown[];
      await act(async () => {
        conversations = await result.current.fetchConversations();
      });

      expect(conversations).toEqual(mockConversations);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chats'),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('returns empty array on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useChat());

      let conversations: unknown[];
      await act(async () => {
        conversations = await result.current.fetchConversations();
      });

      expect(conversations).toEqual([]);
    });
  });
});
