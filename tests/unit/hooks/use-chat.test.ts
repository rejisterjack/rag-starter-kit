import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '@/hooks/use-chat';

// Mock the AI SDK
vi.mock('ai/react', () => ({
  useChat: vi.fn(),
}));

import { useChat as useAIChat } from 'ai/react';

describe('useChat', () => {
  const mockAppend = vi.fn();
  const mockReload = vi.fn();
  const mockStop = vi.fn();
  const mockSetMessages = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: [],
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      isLoading: false,
      error: null,
      append: mockAppend,
      reload: mockReload,
      stop: mockStop,
      setMessages: mockSetMessages,
      data: undefined,
    });
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useChat({ api: '/api/chat' }));
    
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('Message Sending', () => {
    it('sends a message successfully', async () => {
      mockAppend.mockResolvedValueOnce(undefined);
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      await act(async () => {
        await result.current.sendMessage('Hello');
      });
      
      expect(mockAppend).toHaveBeenCalledWith({
        role: 'user',
        content: 'Hello',
      });
    });

    it('sends message with context', async () => {
      mockAppend.mockResolvedValueOnce(undefined);
      
      const { result } = renderHook(() => useChat({ 
        api: '/api/chat',
        body: { workspaceId: 'ws-1' }
      }));
      
      await act(async () => {
        await result.current.sendMessage('Hello', {
          context: { documents: ['doc-1'] }
        });
      });
      
      expect(mockAppend).toHaveBeenCalledWith(expect.objectContaining({
        role: 'user',
        content: 'Hello',
      }));
    });

    it('handles sending empty messages gracefully', async () => {
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      await act(async () => {
        await result.current.sendMessage('');
      });
      
      expect(mockAppend).not.toHaveBeenCalled();
    });

    it('prevents sending while loading', async () => {
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [],
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: true,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      await act(async () => {
        await result.current.sendMessage('Hello');
      });
      
      expect(mockAppend).not.toHaveBeenCalled();
    });
  });

  describe('Streaming Handling', () => {
    it('tracks streaming state', async () => {
      const { result, rerender } = renderHook(() => useChat({ api: '/api/chat' }));
      
      expect(result.current.isStreaming).toBe(false);
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [{ id: '1', role: 'assistant', content: 'Hello' }],
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: true,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      rerender();
      
      expect(result.current.isStreaming).toBe(true);
    });

    it('receives streamed content', async () => {
      const messages = [
        { id: '1', role: 'user', content: 'Hi' },
        { id: '2', role: 'assistant', content: 'Hello! How can I help?' },
      ];
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('Hello! How can I help?');
    });

    it('stops streaming on request', () => {
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      act(() => {
        result.current.stopGeneration();
      });
      
      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors', async () => {
      const error = new Error('API Error');
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [],
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      expect(result.current.error).toEqual(error);
      expect(result.current.isError).toBe(true);
    });

    it('retries failed requests', async () => {
      mockReload.mockResolvedValueOnce(undefined);
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      await act(async () => {
        await result.current.retry();
      });
      
      expect(mockReload).toHaveBeenCalled();
    });

    it('clears error state', () => {
      const onError = vi.fn();
      
      renderHook(() => useChat({ 
        api: '/api/chat',
        onError,
      }));
      
      // Simulate error callback
      const errorCallback = (useAIChat as ReturnType<typeof vi.fn>).mock.calls[0][0].onError;
      errorCallback(new Error('Test error'));
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Message Management', () => {
    it('clears all messages', () => {
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      act(() => {
        result.current.clearMessages();
      });
      
      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });

    it('deletes a specific message', () => {
      const messages = [
        { id: '1', role: 'user', content: 'First' },
        { id: '2', role: 'assistant', content: 'Response' },
        { id: '3', role: 'user', content: 'Second' },
      ];
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      act(() => {
        result.current.deleteMessage('2');
      });
      
      expect(mockSetMessages).toHaveBeenCalledWith([
        messages[0],
        messages[2],
      ]);
    });

    it('edits a message and regenerates response', async () => {
      const messages = [
        { id: '1', role: 'user', content: 'Original' },
        { id: '2', role: 'assistant', content: 'Response' },
      ];
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      await act(async () => {
        await result.current.editMessage('1', 'Edited');
      });
      
      expect(mockSetMessages).toHaveBeenCalledWith([
        { ...messages[0], content: 'Edited' },
      ]);
      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('Citation Handling', () => {
    it('extracts citations from message annotations', () => {
      const messages = [
        {
          id: '1',
          role: 'assistant',
          content: 'According to the report...',
          annotations: [
            { type: 'citation', documentId: 'doc-1', chunkId: 'chunk-1', page: 5 },
          ],
        },
      ];
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        isLoading: false,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      const citations = result.current.getCitations('1');
      expect(citations).toHaveLength(1);
      expect(citations[0]).toMatchObject({
        documentId: 'doc-1',
        page: 5,
      });
    });
  });

  describe('Input Handling', () => {
    it('sets input value', () => {
      const handleInputChange = vi.fn();
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [],
        input: '',
        handleInputChange,
        handleSubmit: vi.fn(),
        isLoading: false,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      const mockEvent = {
        target: { value: 'New input' },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      act(() => {
        result.current.handleInputChange(mockEvent);
      });
      
      expect(handleInputChange).toHaveBeenCalledWith(mockEvent);
    });

    it('submits with input', () => {
      const handleSubmit = vi.fn();
      
      (useAIChat as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [],
        input: 'Test input',
        handleInputChange: vi.fn(),
        handleSubmit,
        isLoading: false,
        error: null,
        append: mockAppend,
        reload: mockReload,
        stop: mockStop,
        setMessages: mockSetMessages,
      });
      
      const { result } = renderHook(() => useChat({ api: '/api/chat' }));
      
      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent;
      
      act(() => {
        result.current.handleSubmit(mockEvent);
      });
      
      expect(handleSubmit).toHaveBeenCalledWith(mockEvent, expect.any(Object));
    });
  });
});
