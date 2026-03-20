/**
 * React Hook for Agentic Chat
 */

'use client';

import { useCallback, useRef, useState } from 'react';

// Local type definition for Message to avoid external dependency
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
}

// Local implementation of useChat hook since 'ai/react' is not available
interface UseChatOptions {
  api: string;
  body?: Record<string, unknown>;
  onResponse?: (response: Response) => void;
  onFinish?: () => void;
  onError?: (error: Error) => void;
}

interface UseChatReturn {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  stop: () => void;
  reload: () => void;
  setMessages: (messages: Message[]) => void;
  error: Error | null;
}

function useChat(options: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!input.trim()) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setError(null);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(options.api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            ...options.body,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        options.onResponse?.(response);

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let assistantContent = '';
        const assistantMessageId = crypto.randomUUID();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          setMessages((prev) => {
            const existing = prev.find((m) => m.id === assistantMessageId);
            if (existing) {
              return prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: assistantContent } : m
              );
            }
            return [
              ...prev,
              {
                id: assistantMessageId,
                role: 'assistant',
                content: assistantContent,
                createdAt: new Date(),
              },
            ];
          });
        }

        options.onFinish?.();
      } catch (err) {
        const errorInstance = err instanceof Error ? err : new Error(String(err));
        setError(errorInstance);
        options.onError?.(errorInstance);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [input, options]
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const reload = useCallback(() => {
    // Retry last message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      // Remove last assistant message if exists
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (prev[lastIndex]?.role === 'assistant') {
          return prev.slice(0, lastIndex);
        }
        return prev;
      });

      // Resubmit
      setInput(lastUserMessage.content);
      setTimeout(() => handleSubmit(), 0);
    }
  }, [messages, handleSubmit]);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    reload,
    setMessages,
    error,
  };
}

export type AgentState =
  | 'idle'
  | 'classifying'
  | 'reasoning'
  | 'executing'
  | 'responding'
  | 'completed'
  | 'error';

export interface ReActStep {
  id: string;
  type: 'thought' | 'action' | 'observation' | 'final';
  content: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
}

export interface AgentMessage extends Message {
  strategy?: string;
  steps?: ReActStep[];
  sources?: Array<{
    id: string;
    documentName: string;
    content: string;
    similarity: number;
  }>;
}

export interface UseAgentChatOptions {
  conversationId?: string;
  workspaceId?: string;
  onStateChange?: (state: AgentState) => void;
  onStep?: (step: ReActStep) => void;
}

export interface UseAgentChatReturn {
  messages: AgentMessage[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  agentState: AgentState;
  currentStrategy?: string;
  steps: ReActStep[];
  stop: () => void;
  reload: () => void;
  setMessages: (messages: AgentMessage[]) => void;
  error?: Error;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [currentStrategy, setCurrentStrategy] = useState<string>();
  const [steps, setSteps] = useState<ReActStep[]>([]);
  const stepsRef = useRef<ReActStep[]>([]);

  const handleStateChange = useCallback(
    (state: AgentState) => {
      setAgentState(state);
      options.onStateChange?.(state);
    },
    [options]
  );

  const handleStep = useCallback(
    (step: ReActStep) => {
      stepsRef.current = [...stepsRef.current, step];
      setSteps(stepsRef.current);
      options.onStep?.(step);
    },
    [options]
  );

  // Use handleStep to avoid TS6133 error while keeping the callback available
  void handleStep;

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    reload,
    setMessages,
    error,
  } = useChat({
    api: '/api/chat/agent',
    body: {
      conversationId: options.conversationId,
      workspaceId: options.workspaceId,
    },
    onResponse: (response: Response) => {
      const strategy = response.headers.get('X-Strategy');
      if (strategy) {
        setCurrentStrategy(strategy);
      }
      handleStateChange('responding');
    },
    onFinish: () => {
      handleStateChange('completed');
    },
    onError: () => {
      handleStateChange('error');
    },
  });

  const wrappedHandleSubmit = useCallback(
    (e?: React.FormEvent) => {
      handleStateChange('classifying');
      stepsRef.current = [];
      setSteps([]);
      handleSubmit(e);
    },
    [handleSubmit, handleStateChange]
  );

  return {
    messages: messages as AgentMessage[],
    input,
    handleInputChange,
    handleSubmit: wrappedHandleSubmit,
    isLoading,
    agentState,
    currentStrategy,
    steps,
    stop,
    reload,
    setMessages: setMessages as (messages: AgentMessage[]) => void,
    error: error as Error | undefined,
  };
}

// Helper functions
export function getAgentStateLabel(state: AgentState): string {
  const labels: Record<AgentState, string> = {
    idle: 'Ready',
    classifying: 'Analyzing query...',
    reasoning: 'Thinking...',
    executing: 'Using tools...',
    responding: 'Generating response...',
    completed: 'Done',
    error: 'Error occurred',
  };
  return labels[state];
}

export function getAgentStateColor(state: AgentState): string {
  const colors: Record<AgentState, string> = {
    idle: 'text-muted-foreground',
    classifying: 'text-blue-500',
    reasoning: 'text-yellow-500',
    executing: 'text-purple-500',
    responding: 'text-green-500',
    completed: 'text-muted-foreground',
    error: 'text-red-500',
  };
  return colors[state];
}

export default useAgentChat;
