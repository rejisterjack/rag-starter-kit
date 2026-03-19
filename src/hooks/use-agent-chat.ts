/**
 * React Hook for Agentic Chat
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useChat, type Message } from 'ai/react';

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

  const handleStateChange = useCallback((state: AgentState) => {
    setAgentState(state);
    options.onStateChange?.(state);
  }, [options]);

  const handleStep = useCallback((step: ReActStep) => {
    stepsRef.current = [...stepsRef.current, step];
    setSteps(stepsRef.current);
    options.onStep?.(step);
  }, [options]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, reload, setMessages, error } = useChat({
    api: '/api/chat/agent',
    body: {
      conversationId: options.conversationId,
      workspaceId: options.workspaceId,
    },
    onResponse: (response) => {
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

  const wrappedHandleSubmit = useCallback((e?: React.FormEvent) => {
    handleStateChange('classifying');
    stepsRef.current = [];
    setSteps([]);
    handleSubmit(e);
  }, [handleSubmit, handleStateChange]);

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
