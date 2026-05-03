'use client';

import { createContext, type ReactNode, useContext, useReducer } from 'react';
import type { Source } from './citations';

// =============================================================================
// State
// =============================================================================

interface ChatState {
  isSourcesPanelOpen: boolean;
  isSourcesInlineCollapsed: boolean;
  selectedSource: Source | null;
  isAgentMode: boolean;
  isHistoryPanelOpen: boolean;
}

const initialState: ChatState = {
  isSourcesPanelOpen: false,
  isSourcesInlineCollapsed: true,
  selectedSource: null,
  isAgentMode: false,
  isHistoryPanelOpen: false,
};

// =============================================================================
// Actions
// =============================================================================

type ChatAction =
  | { type: 'SET_SOURCES_PANEL_OPEN'; open: boolean }
  | { type: 'TOGGLE_SOURCES_INLINE' }
  | { type: 'SET_SELECTED_SOURCE'; source: Source }
  | { type: 'SET_AGENT_MODE'; enabled: boolean }
  | { type: 'SET_HISTORY_PANEL_OPEN'; open: boolean };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_SOURCES_PANEL_OPEN':
      return { ...state, isSourcesPanelOpen: action.open };
    case 'TOGGLE_SOURCES_INLINE':
      return { ...state, isSourcesInlineCollapsed: !state.isSourcesInlineCollapsed };
    case 'SET_SELECTED_SOURCE':
      return { ...state, selectedSource: action.source };
    case 'SET_AGENT_MODE':
      return { ...state, isAgentMode: action.enabled };
    case 'SET_HISTORY_PANEL_OPEN':
      return { ...state, isHistoryPanelOpen: action.open };
    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

interface ChatContextValue {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  initialAgentMode,
}: {
  children: ReactNode;
  initialAgentMode?: boolean;
}) {
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    isAgentMode: initialAgentMode ?? false,
  });

  return <ChatContext.Provider value={{ state, dispatch }}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within a ChatProvider');
  return ctx;
}
