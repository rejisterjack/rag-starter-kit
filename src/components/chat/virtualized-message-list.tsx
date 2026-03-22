/**
 * Virtualized Message List
 * 
 * High-performance message list using windowing/virtualization
 * for handling thousands of messages efficiently.
 * 
 * Features:
 * - Virtual scrolling for large message lists
 * - Dynamic row heights based on content
 * - Auto-scroll to bottom for new messages
 * - Scroll to specific message
 * - Smooth scroll animations
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';

// =============================================================================
// Types
// =============================================================================

interface VirtualizedMessageListProps {
  messages: Message[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onMessageClick?: (messageId: string) => void;
  renderMessage: (message: Message, index: number) => React.ReactNode;
  className?: string;
  /** Auto-scroll to bottom on new messages */
  autoScroll?: boolean;
  /** Scroll to this message ID on mount */
  initialScrollTo?: string;
  /** Estimated height of a message row in pixels */
  estimatedRowHeight?: number;
  /** Gap between messages */
  gap?: number;
}


// =============================================================================
// Components
// =============================================================================

export function VirtualizedMessageList({
  messages,
  isLoading,
  hasMore,
  onLoadMore,
  onMessageClick,
  renderMessage,
  className,
  autoScroll = true,
  initialScrollTo,
  estimatedRowHeight = 100,
  gap = 16,
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizerRef = useRef<ReturnType<typeof useVirtualizer> | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const lastMessageCountRef = useRef(messages.length);

  // Reverse messages for bottom-up virtualization
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: reversedMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => estimatedRowHeight, [estimatedRowHeight]),
    overscan: 5,
    measureElement: (element) => {
      // Measure actual element height including gap
      return element.getBoundingClientRect().height + gap;
    },
  });

  virtualizerRef.current = virtualizer;

  const virtualItems = virtualizer.getVirtualItems();

  // Track scroll position
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
      
      if (!atBottom) {
        setUserScrolled(true);
      }
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!autoScroll) return;
    if (messages.length <= lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;
      return;
    }

    lastMessageCountRef.current = messages.length;

    // Only auto-scroll if user hasn't manually scrolled up
    if (!userScrolled || isAtBottom) {
      virtualizer.scrollToIndex(0, { align: 'start' });
      setUserScrolled(false);
    }
  }, [messages.length, autoScroll, userScrolled, isAtBottom, virtualizer]);

  // Scroll to specific message on mount
  useEffect(() => {
    if (!initialScrollTo || !messages.length) return;

    const index = reversedMessages.findIndex(m => m.id === initialScrollTo);
    if (index !== -1) {
      virtualizer.scrollToIndex(index, { align: 'center' });
    }
  }, [initialScrollTo, reversedMessages, virtualizer]);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(0, { align: 'start' });
    setUserScrolled(false);
  }, [virtualizer]);

  // Scroll to message handler
  const scrollToMessage = useCallback((messageId: string) => {
    const index = reversedMessages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      virtualizer.scrollToIndex(index, { align: 'center' });
    }
  }, [reversedMessages, virtualizer]);

  // Load more when scrolling to top
  useEffect(() => {
    if (!hasMore || isLoading || !onLoadMore) return;

    const [firstItem] = virtualItems;
    if (firstItem && firstItem.index >= reversedMessages.length - 10) {
      onLoadMore();
    }
  }, [virtualItems, hasMore, isLoading, onLoadMore, reversedMessages.length]);

  return (
    <div className={cn("relative flex flex-col h-full", className)}>
      {/* Message List */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto scroll-smooth"
        style={{ 
          display: 'flex',
          flexDirection: 'column-reverse',
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const message = reversedMessages[virtualItem.index];
            if (!message) return null;

            return (
              <div
                key={message.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="px-4 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onMessageClick?.(message.id)}
                onKeyDown={(e) => e.key === 'Enter' && onMessageClick?.(message.id)}
              >
                {renderMessage(message, messages.length - 1 - virtualItem.index)}
              </div>
            );
          })}
        </div>

        {/* Loading indicator at top (which is bottom due to reverse) */}
        {isLoading && (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4 mr-2" />
          Scroll to bottom
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Simpler Alternative: Windowed List for moderate sizes
// =============================================================================

interface WindowedMessageListProps {
  messages: Message[];
  renderMessage: (message: Message, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  itemHeight?: number;
}

/**
 * Simpler windowed list for moderate message counts (< 1000)
 * Uses a simpler approach without reverse scrolling
 */
export function WindowedMessageList({
  messages,
  renderMessage,
  className,
  overscan = 3,
  itemHeight = 100,
}: WindowedMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const totalHeight = messages.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    messages.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleMessages = messages.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleMessages.map((message, i) => (
            <div key={message.id} style={{ height: itemHeight }}>
              {renderMessage(message, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Hook for message list virtualization
// =============================================================================

export function useMessageVirtualization(messages: Message[], options?: {
  enabled?: boolean;
  threshold?: number;
}) {
  const { enabled = true, threshold = 50 } = options ?? {};

  const shouldVirtualize = enabled && messages.length > threshold;

  return {
    shouldVirtualize,
    Component: shouldVirtualize ? VirtualizedMessageList : SimpleMessageList,
  };
}

// Simple non-virtualized fallback
function SimpleMessageList({
  messages,
  renderMessage,
  className,
}: {
  messages: Message[];
  renderMessage: (message: Message, index: number) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 overflow-auto", className)}>
      {messages.map((message, index) => (
        <div key={message.id}>
          {renderMessage(message, index)}
        </div>
      ))}
    </div>
  );
}
