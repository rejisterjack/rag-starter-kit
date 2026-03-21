'use client';

import { FileText, MessageSquare, Sparkles, Upload, Zap } from 'lucide-react';
import type React from 'react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void;
  onUploadClick?: () => void;
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
    description: 'Add documents to your knowledge base',
  },
  {
    icon: MessageSquare,
    label: 'Start Chat',
    description: 'Ask questions about your documents',
  },
  {
    icon: Zap,
    label: 'Quick Summary',
    description: 'Get a summary of all documents',
  },
];

export function EmptyState({ onSuggestionClick, onUploadClick, className }: EmptyStateProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onUploadClick?.();
    },
    [onUploadClick]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <section
      className={cn('flex h-full flex-col items-center justify-center p-8', className)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      aria-label="Empty state"
    >
      <div className="mx-auto max-w-2xl text-center">
        {/* Welcome header */}
        <div className="mb-8">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome to RAG Chat</h1>
          <p className="text-lg text-muted-foreground">
            Upload documents and ask questions. I&apos;ll find the answers from your knowledge base.
          </p>
        </div>

        {/* Quick actions */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Card
              key={action.label}
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
              onClick={() =>
                action.label === 'Upload PDF'
                  ? onUploadClick?.()
                  : onSuggestionClick?.(action.label)
              }
            >
              <CardContent className="flex flex-col items-center p-4 text-center">
                <div className="mb-2 rounded-lg bg-primary/10 p-2">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium">{action.label}</h3>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upload zone */}
        <button
          type="button"
          className="mb-8 w-full rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
          onClick={onUploadClick}
        >
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Drop files here to upload</p>
          <p className="text-sm text-muted-foreground">Supports PDF, Word, TXT, and more</p>
          <Button variant="outline" className="mt-4" size="sm">
            Choose Files
          </Button>
        </button>

        {/* Suggested questions */}
        <div>
          <p className="mb-3 text-sm font-medium text-muted-foreground">Try asking:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                className="rounded-full"
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
}
