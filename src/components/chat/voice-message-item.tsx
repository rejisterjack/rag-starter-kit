'use client';

/**
 * Voice-enabled Message Item Component
 * Enhanced message item with text-to-speech support
 */

import { Bot, Check, Copy, Pencil, Trash2, User, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SpeakButton } from '@/components/voice/speak-button';
import { cn, formatRelativeTime } from '@/lib/utils';
// import { useVoiceOutput } from "@/hooks/use-voice";
import type { VoiceSettings } from '@/lib/voice';
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

interface VoiceMessageItemProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onCitationClick?: (index: number) => void;
  showSources?: boolean;
  /** Whether to auto-play assistant messages */
  autoPlay?: boolean;
  /** Voice settings */
  voiceSettings?: Partial<VoiceSettings>;
  /** Callback when message starts speaking */
  onSpeakStart?: (messageId: string) => void;
  /** Callback when message stops speaking */
  onSpeakEnd?: (messageId: string) => void;
}

export function VoiceMessageItem({
  message,
  onEdit,
  onDelete,
  onCitationClick,
  showSources = true,
  autoPlay = false,
  voiceSettings,
  onSpeakStart,
  onSpeakEnd,
}: VoiceMessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [localAutoPlay, setLocalAutoPlay] = useState(autoPlay);

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

  // Handle speak events
  const handleSpeakStart = useCallback(() => {
    onSpeakStart?.(message.id);
  }, [message.id, onSpeakStart]);

  const handleSpeakEnd = useCallback(() => {
    onSpeakEnd?.(message.id);
  }, [message.id, onSpeakEnd]);

  return (
    <div className={cn('group relative py-6', isUser ? 'bg-background' : 'bg-muted/30')}>
      <div className="mx-auto flex max-w-3xl gap-4 px-4">
        {/* Avatar */}
        <div className="flex shrink-0 flex-col items-center">
          <Avatar
            className={cn(
              'h-8 w-8',
              isUser ? 'bg-primary text-primary-foreground' : 'bg-green-600 text-white'
            )}
          >
            <AvatarFallback>
              {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold">{isUser ? 'You' : 'Assistant'}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(message.createdAt)}
            </span>
            {message.model && (
              <span className="text-xs text-muted-foreground">· {message.model}</span>
            )}

            {/* Auto-play toggle for assistant messages */}
            {isAssistant && (
              <div className="ml-auto flex items-center gap-2">
                <Label
                  htmlFor={`autoplay-${message.id}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Auto-play
                </Label>
                <Switch
                  id={`autoplay-${message.id}`}
                  checked={localAutoPlay}
                  onCheckedChange={setLocalAutoPlay}
                  className="scale-75"
                />
              </div>
            )}
          </div>

          {/* Message content */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[100px] resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  <Check className="mr-1 h-4 w-4" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  <X className="mr-1 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-foreground">
                <Markdown content={message.content} onCitationClick={onCitationClick} />
              </div>

              {/* Sources for assistant messages */}
              {isAssistant && showSources && message.sources && message.sources.length > 0 && (
                <div className="mt-4">
                  <CitationList
                    sources={message.sources}
                    onSourceClick={(source) => onCitationClick?.(source.index)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <TooltipProvider>
              <div className="flex items-center gap-1">
                {/* Speak button for assistant messages */}
                {isAssistant && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <SpeakButton
                          text={message.content}
                          language={voiceSettings?.synthesisLanguage}
                          rate={voiceSettings?.speechRate}
                          pitch={voiceSettings?.speechPitch}
                          autoPlay={localAutoPlay && !message.isStreaming}
                          onSpeakStart={handleSpeakStart}
                          onSpeakEnd={handleSpeakEnd}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Read aloud</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{copied ? 'Copied!' : 'Copy message'}</p>
                  </TooltipContent>
                </Tooltip>

                {(isUser || isAssistant) && (onEdit || onDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">More options</span>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                        >
                          <title>More options</title>
                          <path
                            d="M3.625 7.5C3.625 7.15482 3.905 6.875 4.25 6.875C4.595 6.875 4.875 7.15482 4.875 7.5C4.875 7.84518 4.595 8.125 4.25 8.125C3.905 8.125 3.625 7.84518 3.625 7.5ZM7.125 7.5C7.125 7.15482 7.405 6.875 7.75 6.875C8.095 6.875 8.375 7.15482 8.375 7.5C8.375 7.84518 8.095 8.125 7.75 8.125C7.405 8.125 7.125 7.84518 7.125 7.5ZM10.625 7.5C10.625 7.15482 10.905 6.875 11.25 6.875C11.595 6.875 11.875 7.15482 11.875 7.5C11.875 7.84518 11.595 8.125 11.25 8.125C10.905 8.125 10.625 7.84518 10.625 7.5Z"
                            fill="currentColor"
                          />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isUser && onEdit && (
                        <DropdownMenuItem onClick={() => setIsEditing(true)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(message.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
    </div>
  );
}

// =============================================================================
// Voice Message List Component
// =============================================================================

interface VoiceMessageListProps {
  messages: Message[];
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onCitationClick?: (index: number) => void;
  showSources?: boolean;
  /** Auto-play settings */
  autoPlaySettings?: {
    enabled: boolean;
    voiceSettings?: Partial<VoiceSettings>;
  };
  /** Currently speaking message ID */
  speakingMessageId?: string | null;
  /** Callback when a message starts/stops speaking */
  onSpeakingChange?: (messageId: string | null) => void;
}

export function VoiceMessageList({
  messages,
  onEdit,
  onDelete,
  onCitationClick,
  showSources = true,
  autoPlaySettings,
  speakingMessageId,
  onSpeakingChange,
}: VoiceMessageListProps) {
  const [_currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(
    speakingMessageId ?? null
  );

  // Sync with external speaking state
  useEffect(() => {
    setCurrentSpeakingId(speakingMessageId ?? null);
  }, [speakingMessageId]);

  const handleSpeakStart = useCallback(
    (messageId: string) => {
      setCurrentSpeakingId(messageId);
      onSpeakingChange?.(messageId);
    },
    [onSpeakingChange]
  );

  const handleSpeakEnd = useCallback(
    (messageId: string) => {
      setCurrentSpeakingId((prev) => {
        if (prev === messageId) {
          onSpeakingChange?.(null);
          return null;
        }
        return prev;
      });
    },
    [onSpeakingChange]
  );

  return (
    <div className="space-y-0">
      {messages.map((message, index) => (
        <VoiceMessageItem
          key={message.id}
          message={message}
          onEdit={onEdit}
          onDelete={onDelete}
          onCitationClick={onCitationClick}
          showSources={showSources}
          autoPlay={
            autoPlaySettings?.enabled &&
            message.role === 'assistant' &&
            index === messages.length - 1 &&
            !message.isStreaming
          }
          voiceSettings={autoPlaySettings?.voiceSettings}
          onSpeakStart={handleSpeakStart}
          onSpeakEnd={handleSpeakEnd}
        />
      ))}
    </div>
  );
}
