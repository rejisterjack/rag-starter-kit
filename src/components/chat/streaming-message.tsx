'use client';

import { Bot, Square } from 'lucide-react';
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Markdown } from './markdown';

interface StreamingMessageProps {
  content: string;
  onCancel?: () => void;
  className?: string;
}

const MemoizedMarkdown = React.memo(function MemoizedMarkdown({ content }: { content: string }) {
  return <Markdown content={content} />;
});

export const StreamingMessage = React.memo(function StreamingMessage({
  content,
  onCancel,
  className,
}: StreamingMessageProps) {
  return (
    <div className={cn('relative py-6 bg-muted/30', className)}>
      <div className="mx-auto flex max-w-3xl gap-4 px-4">
        {/* Avatar */}
        <div className="flex shrink-0 flex-col items-center">
          <Avatar className="h-8 w-8 bg-green-600 text-white">
            <AvatarFallback>
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          {/* Animated indicator */}
          <div className="mt-2 flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-600 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-600 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-600" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold">Assistant</span>
            <span className="text-xs text-muted-foreground">generating...</span>
          </div>

          {/* Message content */}
          <div
            className="text-foreground"
            role="log"
            aria-live="polite"
            aria-label="Assistant response"
          >
            <MemoizedMarkdown content={content || '▌'} />
            {content && (
              <span className="inline-block h-4 w-2 animate-pulse bg-primary align-middle" />
            )}
          </div>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <div>
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
              <Square className="h-3 w-3 fill-current" />
              Stop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
