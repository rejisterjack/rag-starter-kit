'use client';

import {
  Bot,
  Check,
  CloudOff,
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
// Avatar removed — using styled divs for gradient avatars
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatRelativeTime } from '@/lib/utils';
import { CitationList, type Source } from './citations';
import { Markdown } from './markdown';

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'queued';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  sources?: Source[];
  model?: string;
  isStreaming?: boolean;
  /** Offline sync status */
  status?: MessageStatus;
  /** Error message if failed */
  error?: string;
}

export type { Source } from './citations';

import { SuggestedFollowUps } from './suggested-follow-ups';

interface MessageItemProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onCitationClick?: (index: number) => void;
  showSources?: boolean;
  isLastMessage?: boolean;
  isStreaming?: boolean;
  followUpQuestions?: string[];
  onRegenerate?: () => void;
  onFeedback?: (id: string, rating: 'UP' | 'DOWN') => void;
  onFollowUpSelect?: (question: string) => void;
}

export const MessageItem = React.memo(function MessageItem({
  message,
  onEdit,
  onDelete,
  onCitationClick,
  showSources = true,
  isLastMessage = false,
  isStreaming = false,
  followUpQuestions,
  onRegenerate,
  onFeedback,
  onFollowUpSelect,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'UP' | 'DOWN' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const messageStatus = message.status ?? 'sent';
  const isPending = messageStatus === 'pending' || messageStatus === 'sending';
  const isQueued = messageStatus === 'queued';
  const isFailed = messageStatus === 'failed';

  const handleSaveEdit = useCallback(async () => {
    if (editContent.trim() && editContent !== message.content) {
      setIsSaving(true);
      try {
        await onEdit?.(message.id, editContent);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  }, [editContent, message.content, message.id, onEdit]);

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleFeedback = useCallback(
    (rating: 'UP' | 'DOWN') => {
      setFeedback(rating);
      onFeedback?.(message.id, rating);
    },
    [message.id, onFeedback]
  );

  return (
    <article
      aria-label={`${isUser ? 'You' : 'Assistant'} message`}
      className={cn(
        'group relative mb-3',
        isUser ? 'ml-auto w-fit max-w-3xl' : 'mr-auto max-w-3xl'
      )}
    >
      <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
        {/* Avatar */}
        <div className="flex shrink-0 flex-col items-center pt-0.5">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full shadow-md',
              isUser
                ? 'bg-gradient-to-br from-primary to-purple-500 text-white shadow-primary/20'
                : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20'
            )}
          >
            {isUser ? (
              <User className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Bot className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className={cn('min-w-0', !isUser && 'flex-1')}>
          {/* Header */}
          <div className={cn('mb-1 flex items-center gap-2', isUser && 'justify-end')}>
            <span
              className={cn(
                'text-sm font-semibold tracking-tight',
                isUser ? 'text-primary' : 'text-emerald-400'
              )}
            >
              {isUser ? 'You' : 'Assistant'}
            </span>
            <span className="text-xs text-muted-foreground/70 font-medium">
              {formatRelativeTime(message.createdAt)}
            </span>
            {message.model && (
              <span className="text-xs text-muted-foreground/50">· {message.model}</span>
            )}

            {/* Status indicators */}
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 animate-pulse">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Sending...
              </span>
            )}
            {isQueued && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                <CloudOff className="h-2.5 w-2.5" />
                Queued
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                <X className="h-2.5 w-2.5" />
                Failed
              </span>
            )}
          </div>

          {/* Message bubble */}
          <div
            className={cn(
              'relative rounded-2xl px-4 py-3 transition-all',
              isUser
                ? 'bg-primary/10 border border-primary/15 rounded-tr-sm w-fit'
                : 'glass-panel border border-white/10 rounded-tl-sm',
              isPending && 'opacity-80',
              isQueued && 'border-amber-500/20 bg-amber-500/5',
              isFailed && 'border-destructive/20 bg-destructive/5'
            )}
          >
            {isEditing ? (
              <div className="space-y-3 animate-[fade-in_0.2s_ease-out]">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[120px] resize-none bg-background/50 border-white/10 focus-visible:ring-primary/50 rounded-xl"
                  autoFocus
                  aria-label="Edit message content"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="rounded-full shadow-md bg-primary hover:bg-primary/90"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-4 w-4" />
                    )}
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="rounded-full"
                  >
                    <X className="mr-1.5 h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-foreground/90 leading-relaxed prose prose-invert max-w-none text-sm">
                  <Markdown content={message.content} onCitationClick={onCitationClick} />
                </div>

                {/* Sources for assistant messages */}
                {isAssistant && showSources && message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/30">
                    <CitationList
                      sources={message.sources}
                      onSourceClick={(source) => onCitationClick?.(source.index)}
                    />
                  </div>
                )}

                {/* Suggested follow-up questions */}
                {isAssistant &&
                  isLastMessage &&
                  !isStreaming &&
                  onFollowUpSelect &&
                  followUpQuestions &&
                  followUpQuestions.length > 0 && (
                    <SuggestedFollowUps questions={followUpQuestions} onSelect={onFollowUpSelect} />
                  )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions row — below the bubble, aligned with content */}
      {!isEditing && (
        <div
          className={cn(
            'mt-1 flex items-center gap-0.5',
            isUser ? 'justify-end pr-11' : 'pl-11',
            isPending || isQueued || isFailed
              ? 'opacity-100'
              : 'opacity-0 transition-opacity duration-150 group-hover:opacity-100'
          )}
        >
          <TooltipProvider>
            {/* Retry / Remove for failed/queued messages */}
            {(isFailed || isQueued) && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-amber-500/10 text-amber-400"
                      onClick={() => onEdit?.(message.id, message.content)}
                      aria-label="Retry message"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="rounded-lg text-xs glass-panel">
                    <p>Retry</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-destructive"
                      onClick={() => onDelete?.(message.id)}
                      aria-label="Remove message"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="rounded-lg text-xs glass-panel">
                    <p>Remove</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            {isAssistant && isLastMessage && !isStreaming && onRegenerate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-muted/50"
                    onClick={onRegenerate}
                    aria-label="Regenerate response"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="rounded-lg text-xs glass-panel">
                  <p>Regenerate</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isAssistant && onFeedback && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-muted/50"
                      onClick={() => handleFeedback('UP')}
                      disabled={feedback !== null}
                      aria-label="Helpful"
                    >
                      <ThumbsUp
                        className={cn(
                          'h-3.5 w-3.5',
                          feedback === 'UP'
                            ? 'text-emerald-400 fill-emerald-400'
                            : 'text-muted-foreground'
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="rounded-lg text-xs glass-panel">
                    <p>Helpful</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-muted/50"
                      onClick={() => handleFeedback('DOWN')}
                      disabled={feedback !== null}
                      aria-label="Not helpful"
                    >
                      <ThumbsDown
                        className={cn(
                          'h-3.5 w-3.5',
                          feedback === 'DOWN'
                            ? 'text-red-400 fill-red-400'
                            : 'text-muted-foreground'
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="rounded-lg text-xs glass-panel">
                    <p>Not helpful</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg hover:bg-muted/50"
                  onClick={handleCopy}
                  aria-label={copied ? 'Copied' : 'Copy message'}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="rounded-lg text-xs glass-panel">
                <p>{copied ? 'Copied!' : 'Copy'}</p>
              </TooltipContent>
            </Tooltip>

            {(isUser || isAssistant) && (onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-muted/50 text-muted-foreground"
                  >
                    <span className="sr-only">More options</span>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <title>More options</title>
                      <path
                        d="M3.625 7.5C3.625 7.15482 3.905 6.875 4.25 6.875C4.595 6.875 4.875 7.15482 4.875 7.5C4.875 7.84518 4.595 8.125 4.25 8.125C3.905 8.125 3.625 7.84518 3.625 7.5ZM7.125 7.5C7.125 7.15482 7.405 6.875 7.75 6.875C8.095 6.875 8.375 7.15482 8.375 7.5C8.375 7.84518 8.095 8.125 7.75 8.125C7.405 8.125 7.125 7.84518 7.125 7.5ZM10.625 7.5C10.625 7.15482 10.905 6.875 11.25 6.875C11.595 6.875 11.875 7.15482 11.875 7.5C11.875 7.84518 11.595 8.125 11.25 8.125C10.905 8.125 10.625 7.84518 10.625 7.5Z"
                        fill="currentColor"
                      />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-xl glass-panel border-white/10 min-w-32"
                >
                  {isUser && onEdit && (
                    <DropdownMenuItem
                      onClick={() => setIsEditing(true)}
                      className="rounded-lg focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer text-xs"
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(message.id)}
                      className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors cursor-pointer text-xs"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TooltipProvider>
        </div>
      )}
    </article>
  );
});
