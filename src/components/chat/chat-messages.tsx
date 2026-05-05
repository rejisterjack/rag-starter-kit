'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useChatContext } from './chat-context';
import type { Source } from './citations';
import { EmptyState } from './empty-state';
import type { Message } from './message-item';
import { MessageList } from './message-list';
import { InlineSourcesPanel } from './sources-panel';

interface ChatMessagesProps {
  messages: Message[];
  sources: Source[];
  isStreaming: boolean;
  streamingContent: string;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onCancelStreaming?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (messageId: string, rating: 'UP' | 'DOWN') => void;
  onSendMessage: (message: string, files?: File[]) => void;
  onUploadClick?: () => void;
  onFilesDrop?: (files: File[]) => void;
}

/** Fetch contextual follow-up questions from the API */
async function fetchFollowUps(assistantMessage: string, userQuery?: string): Promise<string[]> {
  try {
    const res = await fetch('/api/chat/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistantMessage, userQuery, count: 3 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.questions) ? data.questions : [];
  } catch {
    return [];
  }
}

export const ChatMessages = memo(function ChatMessages({
  messages,
  sources,
  isStreaming,
  streamingContent,
  hasMore,
  isLoading,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onCancelStreaming,
  onRegenerate,
  onFeedback,
  onSendMessage,
  onUploadClick,
  onFilesDrop,
}: ChatMessagesProps) {
  const { state, dispatch } = useChatContext();

  // ── Suggested follow-up questions ────────────────────────────────────────
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const lastAssistantIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isStreaming) {
      setFollowUpQuestions([]);
      return;
    }
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastAssistantIdRef.current === lastMsg.id) return;
    lastAssistantIdRef.current = lastMsg.id;

    const prevUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    fetchFollowUps(lastMsg.content, prevUserMsg?.content).then((qs) => {
      setFollowUpQuestions(qs);
    });
  }, [isStreaming, messages]);

  const handleFollowUpSelect = useCallback(
    (question: string) => {
      setFollowUpQuestions([]);
      onSendMessage(question);
    },
    [onSendMessage]
  );

  // ── Citation click handler ────────────────────────────────────────────────
  const handleCitationClick = useCallback(
    (index: number) => {
      const source = sources.find((s) => s.index === index);
      if (source) {
        dispatch({ type: 'SET_SELECTED_SOURCE', source });
        dispatch({ type: 'SET_SOURCES_PANEL_OPEN', open: true });
      }
    },
    [sources, dispatch]
  );

  const hasMessages = messages.length > 0 || isStreaming;
  const showLoading = isLoading && !isStreaming && messages.length === 0;

  return (
    <div className="overflow-hidden relative flex h-full min-h-0">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
            <div className="flex items-center gap-3 w-full max-w-3xl px-4">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded bg-foreground/10 animate-pulse" />
                <div className="h-16 w-full rounded-xl bg-foreground/5 animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-3 w-full max-w-3xl px-4">
              <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-foreground/10 animate-pulse" />
                <div className="h-12 w-3/4 rounded-xl bg-foreground/5 animate-pulse" />
              </div>
            </div>
          </div>
        ) : hasMessages ? (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
            onCitationClick={handleCitationClick}
            onCancelStreaming={onCancelStreaming}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
            followUpQuestions={followUpQuestions}
            onFollowUpSelect={handleFollowUpSelect}
            isAgentMode={state.isAgentMode}
            agentThinking={state.isAgentMode && isStreaming}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-4">
            <EmptyState
              onSuggestionClick={onSendMessage}
              onUploadClick={onUploadClick}
              onFilesDrop={onFilesDrop}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {!state.isSourcesInlineCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="hidden md:block border-l border-white/10 bg-white/5 backdrop-blur-sm z-20 overflow-y-auto"
          >
            <InlineSourcesPanel
              sources={sources}
              isCollapsed={state.isSourcesInlineCollapsed}
              onToggle={() => dispatch({ type: 'TOGGLE_SOURCES_INLINE' })}
              onSourceClick={(source) => {
                dispatch({ type: 'SET_SELECTED_SOURCE', source });
                dispatch({ type: 'SET_SOURCES_PANEL_OPEN', open: true });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
