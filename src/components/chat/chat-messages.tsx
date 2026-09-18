'use client';

import { ChevronDown } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
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
    const data = await apiFetch<{ questions?: string[] }>('/api/chat/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistantMessage, userQuery, count: 3 }),
    });
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
    setFollowUpQuestions([]);
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

  // ── Scroll-to-bottom button ───────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollButton(distFromBottom > 150);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  return (
    <div
      className="flex-1 min-h-0 overflow-hidden relative flex"
      role="status"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {/* Scrollable messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin"
        aria-busy={showLoading || isStreaming}
        id="chat-scroll-container"
      >
        {showLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
            {/* Assistant message skeleton */}
            <div className="flex gap-3 w-full max-w-3xl">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2.5 w-16 rounded-md animate-pulse" />
                  <div className="h-2.5 w-12 rounded-md animate-pulse opacity-60" />
                </div>
                <div className="h-14 w-full rounded-2xl rounded-tl-sm animate-pulse border border-white/5" />
              </div>
            </div>
            {/* User message skeleton */}
            <div className="flex flex-row-reverse gap-3 w-full max-w-3xl">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <div className="h-2.5 w-10 rounded-md animate-pulse" />
                  <div className="h-2.5 w-12 rounded-md animate-pulse opacity-60" />
                </div>
                <div className="h-10 w-3/4 rounded-2xl rounded-tr-sm animate-pulse border border-white/5 ml-auto" />
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
            scrollContainerId="chat-scroll-container"
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

      {/* ── Desktop inline sources panel (side panel, hidden on mobile) ── */}
      {!state.isSourcesInlineCollapsed && (
        <div
          className="hidden md:block border-l border-white/10 bg-white/5 backdrop-blur-sm z-20 overflow-y-auto transition-all duration-200 ease-out"
          style={{ width: 340 }}
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
        </div>
      )}

      {/* ── Scroll-to-bottom button — fixed to the bottom of the scroll area ── */}
      <div
        className={cn(
          'absolute bottom-4 right-6 z-30 transition-all duration-200',
          showScrollButton
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none'
        )}
        aria-hidden={!showScrollButton}
      >
        <Button
          variant="default"
          size="icon"
          className="h-9 w-9 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground border border-primary-foreground/20"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          tabIndex={showScrollButton ? 0 : -1}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
});
