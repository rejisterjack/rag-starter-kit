'use client';

import { ChevronDown, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type Message, MessageItem } from './message-item';
import { StreamingMessage } from './streaming-message';

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
  className?: string;
}

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
  className,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport as HTMLElement;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
        setAutoScroll(isNearBottom);
      }
    }
  }, []);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [autoScroll, scrollToBottom]);

  return (
    <div className={cn('relative flex-1', className)}>
      <ScrollArea ref={scrollRef} className="h-full" onScroll={handleScroll}>
        <div className="flex flex-col">
          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more messages'
                )}
              </Button>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && !messages.length && (
            <div className="space-y-4 p-4">
              <MessageSkeleton />
              <MessageSkeleton />
              <MessageSkeleton />
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onEdit={onEditMessage}
              onDelete={onDeleteMessage}
              onCitationClick={onCitationClick}
            />
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <StreamingMessage content={streamingContent} onCancel={onCancelStreaming} />
          )}

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-lg"
          onClick={() => {
            setAutoScroll(true);
            scrollToBottom();
          }}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex gap-4 py-6">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
