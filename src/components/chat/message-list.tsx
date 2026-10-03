'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AgentThinkingIndicator } from './agent-thinking-indicator';
import { type Message, MessageItem } from './message-item';
import { StreamingMessage } from './streaming-message';
import { type ToolCall, ToolResultRenderer } from './tool-result-renderer';
import { VirtualizedMessageList } from './virtualized-message-list';

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
  streamingContent?: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onCitationClick?: (index: number) => void;
  onCancelStreaming?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (messageId: string, rating: 'UP' | 'DOWN') => void;
  followUpQuestions?: string[];
  onFollowUpSelect?: (question: string) => void;
  isAgentMode?: boolean;
  agentThinking?: boolean;
  agentSteps?: Array<{ label: string; status: 'pending' | 'active' | 'done' | 'error' }>;
  currentAgentTool?: string;
  scrollContainerId?: string;
  className?: string;
}

/**
 * MessageList — renders messages as a simple list.
 * Scrolling is handled by the parent container (chat-container grid row 2).
 * This component does NOT wrap in ScrollArea to avoid double-scroll issues.
 */
export function MessageList({
  messages,
  isStreaming = false,
  streamingContent = '',
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onCitationClick,
  onCancelStreaming,
  onRegenerate,
  onFeedback,
  followUpQuestions,
  onFollowUpSelect,
  isAgentMode = false,
  agentThinking = false,
  agentSteps,
  currentAgentTool,
  scrollContainerId,
  className,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Helper to get the scroll container element
  const getScrollContainer = useCallback((): HTMLElement | null => {
    if (scrollContainerId) {
      return document.getElementById(scrollContainerId);
    }
    return null;
  }, [scrollContainerId]);

  // Auto-scroll to bottom on new messages / streaming.
  // Uses instant scroll during streaming to avoid jank from competing smooth animations.
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    // Only auto-scroll if user is already near bottom (within 150px)
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (isNearBottom) {
      const anchor = scrollAnchorRef.current ?? endRef.current;
      if (anchor) {
        // Instant scroll during streaming (avoids laggy smooth-scroll pileup),
        // smooth scroll when a new message is added.
        anchor.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' });
      }
    }
  }, [isStreaming, getScrollContainer]);

  const shouldVirtualize = messages.length > 50;

  return (
    <div className={cn('relative', className)}>
      <ul
        className="flex flex-col py-4 px-3 md:px-6 max-w-4xl mx-auto w-full"
        aria-label="Chat messages"
      >
        {/* Load more button */}
        {hasMore && !shouldVirtualize && (
          <div className="flex justify-center py-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
              className="rounded-full shadow-sm glass text-xs h-7"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin text-primary" />
                  <span className="text-muted-foreground">Loading...</span>
                </>
              ) : (
                'Load earlier messages'
              )}
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !messages.length && (
          <div className="space-y-4 p-4">
            <MessageSkeleton align="left" />
            <MessageSkeleton align="right" />
            <MessageSkeleton align="left" />
          </div>
        )}

        {/* Messages — virtualized when > 50 */}
        {shouldVirtualize ? (
          <VirtualizedMessageList
            messages={messages}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            renderMessage={(message, index) => (
              <>
                <MessageItem
                  message={message}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                  onCitationClick={onCitationClick}
                  isLastMessage={index === messages.length - 1}
                  isStreaming={isStreaming}
                  followUpQuestions={index === messages.length - 1 ? followUpQuestions : undefined}
                  onRegenerate={onRegenerate}
                  onFeedback={onFeedback}
                  onFollowUpSelect={onFollowUpSelect}
                />
                {isAgentMode && message.role === 'assistant' && (
                  <div className="mx-4 mt-1 mb-2">
                    <ToolResultRenderer
                      content={message.content}
                      toolCalls={(message as Message & { toolCalls?: ToolCall[] }).toolCalls}
                    />
                  </div>
                )}
              </>
            )}
            className="h-[calc(100vh-300px)]"
          />
        ) : (
          messages.map((message, index) => (
            <li key={message.id}>
              <MessageItem
                message={message}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onCitationClick={onCitationClick}
                isLastMessage={index === messages.length - 1}
                isStreaming={isStreaming}
                followUpQuestions={index === messages.length - 1 ? followUpQuestions : undefined}
                onRegenerate={onRegenerate}
                onFeedback={onFeedback}
                onFollowUpSelect={onFollowUpSelect}
              />
              {isAgentMode && message.role === 'assistant' && (
                <div className="mx-4 mt-1 mb-2">
                  <ToolResultRenderer
                    content={message.content}
                    toolCalls={(message as Message & { toolCalls?: ToolCall[] }).toolCalls}
                  />
                </div>
              )}
            </li>
          ))
        )}

        {/* Agent thinking indicator */}
        {isAgentMode && isStreaming && agentThinking && (
          <AgentThinkingIndicator
            isThinking={true}
            steps={agentSteps}
            currentTool={currentAgentTool}
          />
        )}

        {/* Streaming message */}
        {isStreaming && (
          <div className="mt-1">
            <StreamingMessage content={streamingContent} onCancel={onCancelStreaming} />
          </div>
        )}

        {/* Scroll anchor — scrolls here during streaming */}
        {!shouldVirtualize && <div ref={scrollAnchorRef} className="h-px" />}

        {/* Scroll sentinel */}
        <div ref={endRef} className="h-1" />
      </ul>
    </div>
  );
}

function MessageSkeleton({ align = 'left' }: { align?: 'left' | 'right' }) {
  const isRight = align === 'right';
  return (
    <div className={cn('flex gap-3', isRight && 'flex-row-reverse')}>
      <div
        className={cn(
          'h-8 w-8 shrink-0 rounded-full animate-pulse',
          isRight
            ? 'bg-gradient-to-br from-primary/30 to-purple-500/30'
            : 'bg-gradient-to-br from-emerald-500/30 to-teal-600/30'
        )}
      />
      <div className={cn('flex w-full flex-col min-w-0', isRight ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="h-2.5 w-14 rounded-md animate-pulse" />
          <div className="h-2.5 w-10 rounded-md animate-pulse opacity-60" />
        </div>
        <div
          className={cn(
            'h-16 rounded-2xl animate-pulse border border-white/5',
            isRight ? 'w-[60%] rounded-tr-sm' : 'w-[80%] rounded-tl-sm'
          )}
        />
      </div>
    </div>
  );
}
