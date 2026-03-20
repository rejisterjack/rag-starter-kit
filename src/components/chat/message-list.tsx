"use client";

import { ChevronDown, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [autoScroll, scrollToBottom]);

  return (
    <div className={cn('relative flex-1', className)}>
      <ScrollArea ref={scrollRef} className="h-full scrollbar-thin" onScroll={handleScroll}>
        <div className="flex flex-col py-6 px-2">
          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center py-4 mb-4">
              <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoading} className="rounded-full shadow-sm glass">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">Loading history...</span>
                  </>
                ) : (
                  'Load earlier messages'
                )}
              </Button>
            </div>
          )}

          {/* Loading skeleton */}
          <AnimatePresence>
            {isLoading && !messages.length && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 p-4">
                <MessageSkeleton align="left" />
                <MessageSkeleton align="right" />
                <MessageSkeleton align="left" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onCitationClick={onCitationClick}
              />
            ))}

            {/* Streaming message chunk */}
            {isStreaming && (
              <motion.div
                key="streaming-message"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                layout
                className="mt-4"
              >
                <StreamingMessage content={streamingContent} onCancel={onCancelStreaming} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-10" />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-6 right-8 z-50"
          >
            <Button
              variant="default"
              size="icon"
              className="h-12 w-12 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-primary-foreground/20"
              onClick={() => {
                setAutoScroll(true);
                scrollToBottom();
              }}
            >
              <ChevronDown className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageSkeleton({ align = "left" }: { align?: "left" | "right" }) {
  const isRight = align === "right";
  return (
    <div className={cn("flex gap-4", isRight && "flex-row-reverse")}>
      <Skeleton className={cn("h-10 w-10 shrink-0 rounded-full", isRight ? "bg-primary/20" : "bg-emerald-500/20")} />
      <div className={cn("flex w-full flex-col", isRight ? "items-end" : "items-start")}>
        <Skeleton className="h-5 w-24 rounded-md mb-2 bg-foreground/10" />
        <Skeleton className={cn("h-20 rounded-2xl bg-foreground/5", isRight ? "w-[60%]" : "w-[80%]")} />
      </div>
    </div>
  );
}
