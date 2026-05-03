'use client';

import { Loader2, Paperclip, Send, X } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// File upload constraints
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_COUNT = 10;
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

interface MessageInputProps {
  onSend: (message: string, files?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const MessageInput = memo(function MessageInput({
  onSend,
  onTyping,
  disabled = false,
  isLoading = false,
  placeholder = 'Send a message...',
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 160);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Resize on message change
  // biome-ignore lint/correctness/useExhaustiveDependencies: message triggers resize
  useEffect(() => {
    adjustHeight();
  }, [adjustHeight, message]);

  const handleSubmit = useCallback(() => {
    if (!message.trim() && files.length === 0) return;
    if (disabled || isLoading || isSubmitting) return;

    setIsSubmitting(true);
    onSend(message.trim(), files.length > 0 ? files : undefined);
    setMessage('');
    setFiles([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    // Release submit guard after a tick
    requestAnimationFrame(() => setIsSubmitting(false));
  }, [message, files, disabled, isLoading, isSubmitting, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} exceeds 50MB limit`;
    }
    if (ALLOWED_FILE_TYPES.size > 0 && !ALLOWED_FILE_TYPES.has(file.type) && file.type !== '') {
      return `${file.name}: unsupported file type (${file.type || 'unknown'})`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);

      if (files.length + selectedFiles.length > MAX_FILE_COUNT) {
        toast.error(`Maximum ${MAX_FILE_COUNT} files allowed`);
        e.target.value = '';
        return;
      }

      const validFiles: File[] = [];
      for (const file of selectedFiles) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
      e.target.value = ''; // Reset input
    },
    [files.length, validateFile]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Debounced typing indicator
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (message.length > 0) {
      onTyping?.(true);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
      }, 1000);
    } else {
      onTyping?.(false);
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, onTyping]);

  const hasContent = message.trim().length > 0 || files.length > 0;

  return (
    <div className={cn('w-full', className)}>
      {/* File attachments */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((file, fileIndex) => (
            <Badge
              key={`${file.name}-${file.size}-${file.lastModified}`}
              variant="secondary"
              className="flex items-center gap-1 pr-1 text-xs"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 rounded-full p-0 hover:bg-muted"
                onClick={() => removeFile(fileIndex)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="relative flex items-end gap-2 rounded-xl bg-foreground/5 border border-white/10 p-2 focus-within:bg-background/50 focus-within:ring-1 focus-within:ring-ring/50 transition-colors">
        {/* File attachment button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-lg h-8 w-8"
          disabled={disabled || isLoading}
          asChild
        >
          <label className="cursor-pointer">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.html,.xls,.xlsx"
              onChange={handleFileSelect}
              disabled={disabled || isLoading}
            />
          </label>
        </Button>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="min-h-[36px] max-h-[160px] resize-none border-0 bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
        />

        {/* Send button */}
        <Button
          onClick={handleSubmit}
          disabled={!hasContent || disabled || isLoading || isSubmitting}
          size="icon"
          className={cn(
            'shrink-0 rounded-lg h-8 w-8 transition-colors',
            hasContent && !disabled && !isLoading
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
});
