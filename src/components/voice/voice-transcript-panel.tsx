"use client";

/**
 * Voice Transcript Panel Component
 * Shows interim and final transcripts with editing capability
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, Edit2, Check, X, RotateCcw, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { VoiceWaveform, PulsingDot } from './voice-waveform';
import type { SpeechRecognitionError } from '@/lib/voice';

interface VoiceTranscriptPanelProps {
  /** Whether voice input is active */
  isListening: boolean;
  /** Final transcript text */
  transcript: string;
  /** Interim (not yet finalized) transcript */
  interimTranscript: string;
  /** Full transcript including interim */
  fullTranscript: string;
  /** Confidence score (0-1) */
  confidence?: number | null;
  /** Error if any */
  error?: SpeechRecognitionError | null;
  /** Callback when transcript is edited */
  onTranscriptChange?: (transcript: string) => void;
  /** Callback to send the message */
  onSend?: (transcript: string) => void;
  /** Callback to cancel */
  onCancel?: () => void;
  /** Callback to clear/reset */
  onReset?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show confidence score */
  showConfidence?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

export function VoiceTranscriptPanel({
  isListening,
  transcript,
  interimTranscript,
  fullTranscript,
  confidence,
  error,
  onTranscriptChange,
  onSend,
  onCancel,
  onReset,
  className,
  showConfidence = true,
  placeholder = 'Speak now...',
}: VoiceTranscriptPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(fullTranscript);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update edited text when transcript changes (if not editing)
  useEffect(() => {
    if (!isEditing) {
      setEditedText(fullTranscript);
    }
  }, [fullTranscript, isEditing]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleEditStart = useCallback(() => {
    setEditedText(fullTranscript);
    setIsEditing(true);
  }, [fullTranscript]);

  const handleEditSave = useCallback(() => {
    onTranscriptChange?.(editedText);
    setIsEditing(false);
  }, [editedText, onTranscriptChange]);

  const handleEditCancel = useCallback(() => {
    setEditedText(fullTranscript);
    setIsEditing(false);
  }, [fullTranscript]);

  const handleSend = useCallback(() => {
    const textToSend = isEditing ? editedText : fullTranscript;
    if (textToSend.trim()) {
      onSend?.(textToSend.trim());
    }
  }, [isEditing, editedText, fullTranscript, onSend]);

  const handleReset = useCallback(() => {
    onReset?.();
    setEditedText('');
    setIsEditing(false);
  }, [onReset]);

  // Get confidence color
  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return 'bg-green-500';
    if (conf >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const hasTranscript = fullTranscript.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm',
        isListening && 'border-primary/50 ring-1 ring-primary/20',
        error && 'border-destructive/50 ring-1 ring-destructive/20',
        className
      )}
      role="region"
      aria-label="Voice transcript panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isListening ? (
            <>
              <PulsingDot variant="recording" isActive={true} />
              <span className="text-sm font-medium">Listening...</span>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Error</span>
            </>
          ) : hasTranscript ? (
            <>
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Transcript ready</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Ready</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Confidence badge */}
          {showConfidence && confidence !== null && confidence > 0 && (
            <Badge variant="secondary" className="text-xs">
              {Math.round(confidence * 100)}% confidence
            </Badge>
          )}

          {/* Edit button */}
          {hasTranscript && !isEditing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleEditStart}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit transcript</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Reset button */}
          {hasTranscript && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleReset}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear transcript</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Waveform visualization */}
      {isListening && (
        <div className="mb-4">
          <VoiceWaveform
            isActive={isListening}
            barCount={24}
            height={48}
            variant={error ? 'muted' : 'primary'}
          />
        </div>
      )}

      {/* Confidence bar */}
      {showConfidence && confidence !== null && confidence > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Confidence</span>
            <span>{Math.round(confidence * 100)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full transition-all duration-300', getConfidenceColor(confidence))}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Transcript display / Edit area */}
      <div className="mb-4">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="min-h-[100px] resize-none"
              placeholder="Edit your message..."
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handleEditCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleEditSave}>
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'min-h-[60px] rounded-md border bg-muted/30 p-3',
              !hasTranscript && 'border-dashed'
            )}
          >
            {hasTranscript ? (
              <p className="text-sm whitespace-pre-wrap">
                {transcript && <span>{transcript}</span>}
                {interimTranscript && (
                  <span className="text-muted-foreground">{interimTranscript}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {isListening ? placeholder : 'Press the microphone button to start speaking...'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error.message}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isListening}>
            Cancel
          </Button>
        )}
        {onSend && (
          <Button
            onClick={handleSend}
            disabled={!fullTranscript.trim() && !editedText.trim()}
          >
            <Check className="h-4 w-4 mr-1" />
            Send
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Inline Transcript Badge
// =============================================================================

interface TranscriptBadgeProps {
  transcript: string;
  isInterim?: boolean;
  onEdit?: () => void;
  onClear?: () => void;
  className?: string;
}

export function TranscriptBadge({
  transcript,
  isInterim = false,
  onEdit,
  onClear,
  className,
}: TranscriptBadgeProps) {
  if (!transcript) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
        isInterim ? 'bg-primary/5 border-primary/20' : 'bg-muted border-muted-foreground/20',
        className
      )}
    >
      {isInterim && <PulsingDot variant="default" size="sm" isActive={true} />}
      <span className={cn('max-w-[200px] truncate', isInterim && 'text-primary')}>
        {transcript}
      </span>
      <div className="flex items-center gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-0.5 hover:bg-muted-foreground/10 rounded"
            aria-label="Edit transcript"
          >
            <Edit2 className="h-3 w-3" />
          </button>
        )}
        {onClear && (
          <button
            onClick={onClear}
            className="p-0.5 hover:bg-muted-foreground/10 rounded"
            aria-label="Clear transcript"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Transcript History
// =============================================================================

interface TranscriptHistoryItem {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface TranscriptHistoryProps {
  items: TranscriptHistoryItem[];
  onItemClick?: (item: TranscriptHistoryItem) => void;
  onItemDelete?: (id: string) => void;
  className?: string;
}

export function TranscriptHistory({
  items,
  onItemClick,
  onItemDelete,
  className,
}: TranscriptHistoryProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">
        Recent Transcripts
      </h4>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
            onClick={() => onItemClick?.(item)}
          >
            <span className="text-sm truncate flex-1">{item.text}</span>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {!item.isFinal && (
                <Badge variant="outline" className="text-[10px] h-5">
                  Draft
                </Badge>
              )}
              {onItemDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemDelete(item.id);
                  }}
                  className="p-1 hover:bg-destructive/10 rounded"
                  aria-label="Delete transcript"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
