'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  onFeedback?: (messageId: string, rating: 'up' | 'down') => void;
  isAgentMode?: boolean;
  agentThinking?: boolean;
  agentSteps?: Array<{ label: string; status: 'pending' | 'active' | 'done' | 'error' }>;
  currentAgentTool?: string;
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
  isAgentMode = false,
  agentThinking = false,
  agentSteps,
  currentAgentTool,
  className,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  // Auto-scroll to bottom on new messages / streaming
  // Uses instant scroll during streaming to avoid jank from competing smooth animations.
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — trigger scroll on message count and streaming content changes
  useEffect(() => {
    const anchor = scrollAnchorRef.current ?? endRef.current;
    if (!anchor) return;

    // Instant scroll during streaming (avoids laggy smooth-scroll pileup),
    // smooth scroll when a new message is added.
    anchor.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' });
  }, [messages.length, streamingContent.length, isStreaming]);

  // Observe the sentinel to show/hide scroll-to-bottom button
  useEffect(() => {
    const sentinel = endRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollButton(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const shouldVirtualize = messages.length > 50;

  return (
    <div className={cn('relative', className)}>
      <div className="flex flex-col py-4 px-2">
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
                  onRegenerate={onRegenerate}
                  onFeedback={onFeedback}
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
            <div key={message.id}>
              <MessageItem
                message={message}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onCitationClick={onCitationClick}
                isLastMessage={index === messages.length - 1}
                isStreaming={isStreaming}
                onRegenerate={onRegenerate}
                onFeedback={onFeedback}
              />
              {isAgentMode && message.role === 'assistant' && (
                <div className="mx-4 mt-1 mb-2">
                  <ToolResultRenderer
                    content={message.content}
                    toolCalls={(message as Message & { toolCalls?: ToolCall[] }).toolCalls}
                  />
                </div>
              )}
            </div>
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
          <div className="mt-2">
            <StreamingMessage content={streamingContent} onCancel={onCancelStreaming} />
          </div>
        )}

        {/* Scroll anchor — scrolls here during streaming */}
        {!shouldVirtualize && <div ref={scrollAnchorRef} className="h-px" />}

        {/* Scroll sentinel */}
        <div ref={endRef} className="h-1" />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="sticky bottom-4 float-right mr-6 z-50"
          >
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground border border-primary-foreground/20"
              onClick={scrollToBottom}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageSkeleton({ align = 'left' }: { align?: 'left' | 'right' }) {
  const isRight = align === 'right';
  return (
    <div className={cn('flex gap-3', isRight && 'flex-row-reverse')}>
      <Skeleton
        className={cn(
          'h-8 w-8 shrink-0 rounded-full',
          isRight ? 'bg-primary/20' : 'bg-emerald-500/20'
        )}
      />
      <div className={cn('flex w-full flex-col', isRight ? 'items-end' : 'items-start')}>
        <Skeleton className="h-4 w-20 rounded-md mb-1.5 bg-foreground/10" />
        <Skeleton
          className={cn('h-16 rounded-xl bg-foreground/5', isRight ? 'w-[60%]' : 'w-[80%]')}
        />
      </div>
    </div>
  );
}
