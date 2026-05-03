'use client';

import { FileText, MessageSquare, Upload, Zap } from 'lucide-react';
import type React from 'react';
import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void;
  onUploadClick?: () => void;
  onFilesDrop?: (files: File[]) => void;
  className?: string;
}

const SUGGESTED_QUESTIONS = [
  'What can you help me with?',
  'How do I upload documents?',
  'Summarize my uploaded documents',
  'What is RAG technology?',
];

const QUICK_ACTIONS = [
  {
    icon: FileText,
    label: 'Upload PDF',
    description: 'Add to knowledge base',
    action: 'upload' as const,
  },
  {
    icon: MessageSquare,
    label: 'Start Chat',
    description: 'Ask about documents',
    message: 'What can you help me with?',
  },
  {
    icon: Zap,
    label: 'Quick Summary',
    description: 'Summarize all docs',
    message: 'Summarize my uploaded documents',
  },
];

export const EmptyState = memo(function EmptyState({
  onSuggestionClick,
  onUploadClick,
  onFilesDrop,
  className,
}: EmptyStateProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesDrop?.(files);
      } else {
        onUploadClick?.();
      }
    },
    [onUploadClick, onFilesDrop]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <section
      className={cn('flex flex-col items-center justify-center p-4 max-w-xl mx-auto', className)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      aria-label="Empty state"
    >
      <div className="w-full text-center">
        {/* Welcome header - compact */}
        <div className="mb-4">
          <h1 className="mb-1 text-xl font-bold tracking-tight">Welcome to RAG Chat</h1>
          <p className="text-sm text-muted-foreground">
            Upload documents and ask questions from your knowledge base.
          </p>
        </div>

        {/* Quick actions - compact row */}
        <div className="mb-4 grid gap-2 grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              type="button"
              key={action.label}
              className="flex flex-col items-center p-3 rounded-xl border border-border/50 bg-foreground/5 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer text-center"
              onClick={() =>
                action.action === 'upload'
                  ? onUploadClick?.()
                  : action.message
                    ? onSuggestionClick?.(action.message)
                    : undefined
              }
            >
              <div className="mb-1.5 rounded-lg bg-primary/10 p-1.5">
                <action.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-medium">{action.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{action.description}</span>
            </button>
          ))}
        </div>

        {/* Upload zone - compact */}
        <button
          type="button"
          className="mb-4 w-full rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 p-4 transition-colors hover:border-primary/50 hover:bg-muted/40 cursor-pointer"
          onClick={onUploadClick}
        >
          <Upload className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-xs font-medium">Drop files here or click to upload</p>
          <p className="text-[10px] text-muted-foreground">PDF, Word, TXT, and more</p>
        </button>

        {/* Suggested questions - compact */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Try asking:</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {SUGGESTED_QUESTIONS.map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-7 px-3"
                onClick={() => onSuggestionClick?.(question)}
              >
                {question}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
