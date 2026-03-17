"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Send, Paperclip, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface MessageInputProps {
  onSend: (message: string, files?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageInput({
  onSend,
  onTyping,
  disabled = false,
  isLoading = false,
  placeholder = "Send a message...",
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  const handleSubmit = useCallback(() => {
    if (!message.trim() && files.length === 0) return;
    if (disabled || isLoading) return;

    onSend(message.trim(), files.length > 0 ? files : undefined);
    setMessage("");
    setFiles([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, files, disabled, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      setFiles((prev) => [...prev, ...selectedFiles]);
      e.target.value = ""; // Reset input
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle typing indicator
  useEffect(() => {
    onTyping?.(message.length > 0);
  }, [message, onTyping]);

  const hasContent = message.trim().length > 0 || files.length > 0;

  return (
    <div className={cn("border-t bg-background p-4", className)}>
      <div className="mx-auto max-w-3xl">
        {/* File attachments */}
        {files.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-full p-0 hover:bg-muted"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="relative flex items-end gap-2 rounded-xl border bg-muted/50 p-2 focus-within:bg-background focus-within:ring-1 focus-within:ring-ring">
          {/* File attachment button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-lg"
            disabled={disabled || isLoading}
            asChild
          >
            <label className="cursor-pointer">
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                className="hidden"
                multiple
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
            className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent px-2 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
          />

          {/* Send button */}
          <Button
            onClick={handleSubmit}
            disabled={!hasContent || disabled || isLoading}
            size="icon"
            className={cn(
              "shrink-0 rounded-lg transition-all",
              hasContent && !disabled && !isLoading
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Footer hint */}
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>Press Enter to send</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
