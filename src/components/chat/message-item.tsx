'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Check, Copy, Pencil, Trash2, User, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  sources?: Source[];
  model?: string;
  isStreaming?: boolean;
}

export type { Source } from './citations';

interface MessageItemProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onCitationClick?: (index: number) => void;
  showSources?: boolean;
}

export function MessageItem({
  message,
  onEdit,
  onDelete,
  onCitationClick,
  showSources = true,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit?.(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group relative py-6 px-4 mb-4 rounded-3xl transition-all duration-300',
        isUser
          ? 'ml-auto max-w-3xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_-5px_rgba(124,58,237,0.15)] mr-4'
          : 'glass max-w-3xl mr-auto ml-4'
      )}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex shrink-0 flex-col items-center mt-1">
          <Avatar
            className={cn(
              'h-9 w-9 ring-2 ring-offset-2 ring-offset-background shadow-md',
              isUser
                ? 'bg-primary text-primary-foreground ring-primary/30'
                : 'bg-emerald-500 text-white ring-emerald-500/30'
            )}
          >
            <AvatarFallback>
              {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold tracking-tight',
                isUser ? 'text-primary' : 'text-emerald-500'
              )}
            >
              {isUser ? 'You' : 'Assistant'}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {formatRelativeTime(message.createdAt)}
            </span>
            {message.model && (
              <span className="text-xs text-muted-foreground/60">· {message.model}</span>
            )}
          </div>

          {/* Message content */}
          {isEditing ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[120px] resize-none bg-background/50 border-white/10 focus-visible:ring-primary/50 rounded-xl"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} className="rounded-full shadow-md">
                  <Check className="mr-1.5 h-4 w-4" /> Save
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
            </motion.div>
          ) : (
            <>
              <div className="text-foreground/90 leading-relaxed prose prose-invert max-w-none">
                <Markdown content={message.content} onCitationClick={onCitationClick} />
              </div>

              {/* Sources for assistant messages */}
              <AnimatePresence>
                {isAssistant && showSources && message.sources && message.sources.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-5 pt-4 border-t border-border/40"
                  >
                    <CitationList
                      sources={message.sources}
                      onSourceClick={(source) => onCitationClick?.(source.index)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="absolute right-4 top-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-background/80 backdrop-blur-md rounded-full shadow-sm p-0.5 border border-border/50">
            <TooltipProvider>
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-foreground/5"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-lg text-xs border-none shadow-xl bg-popover/90 backdrop-blur-md">
                    <p>{copied ? 'Copied!' : 'Copy message'}</p>
                  </TooltipContent>
                </Tooltip>

                {(isUser || isAssistant) && (onEdit || onDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-foreground/5 text-muted-foreground"
                      >
                        <span className="sr-only">More options</span>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
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
                      className="rounded-xl glass shadow-2xl border-white/10 min-w-32"
                    >
                      {isUser && onEdit && (
                        <DropdownMenuItem
                          onClick={() => setIsEditing(true)}
                          className="rounded-md focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(message.id)}
                          className="rounded-md text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </TooltipProvider>
          </div>
        )}
      </div>
    </motion.div>
  );
}
