"use client";

/**
 * Enhanced Message Input with Voice Support
 * Extension of the base MessageInput component with voice input capabilities
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Send, Paperclip, Loader2, X, Mic, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVoiceInput, useVoiceCommands } from "@/hooks/use-voice";
import { VoiceSettingsPanel } from "@/components/voice/voice-settings";
import { VoiceTranscriptPanel } from "@/components/voice/voice-transcript-panel";
import { VoiceWaveform, PulsingDot } from "@/components/voice/voice-waveform";
import type { VoiceSettings, SupportedLanguage } from "@/lib/voice";

interface MessageInputVoiceProps {
  onSend: (message: string, files?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  /** Default voice settings */
  defaultVoiceSettings?: Partial<VoiceSettings>;
  /** Callback when voice settings change */
  onVoiceSettingsChange?: (settings: VoiceSettings) => void;
  /** Enable voice commands */
  enableVoiceCommands?: boolean;
}

export function MessageInputVoice({
  onSend,
  onTyping,
  disabled = false,
  isLoading = false,
  placeholder = "Send a message...",
  className,
  defaultVoiceSettings,
  onVoiceSettingsChange,
  enableVoiceCommands = true,
}: MessageInputVoiceProps) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | undefined>(
    defaultVoiceSettings as VoiceSettings
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input hook
  const {
    isListening,
    transcript: voiceTranscript,
    interimTranscript,
    fullTranscript,
    error: voiceError,
    confidence,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useVoiceInput({
    language: voiceSettings?.recognitionLanguage ?? 'en-US',
    continuous: voiceSettings?.inputMode === 'continuous',
    interimResults: true,
    onFinalResult: useCallback((finalTranscript: string) => {
      // Append to existing message
      setMessage(prev => {
        const separator = prev && !prev.endsWith(' ') ? ' ' : '';
        return prev + separator + finalTranscript;
      });
    }, []),
  });

  // Voice commands
  const { registerCommand, unregisterCommand } = useVoiceCommands({
    enabled: enableVoiceCommands && isVoiceSupported,
  });

  // Register voice commands
  useEffect(() => {
    if (!enableVoiceCommands || !isVoiceSupported) return;

    registerCommand({
      id: 'send-message',
      phrases: ['send message', 'send', 'submit'],
      description: 'Send the current message',
      handler: () => {
        if (message.trim()) {
          handleSubmit();
        }
      },
    });

    registerCommand({
      id: 'clear-input',
      phrases: ['clear', 'clear input', 'delete all'],
      description: 'Clear the input field',
      handler: () => {
        setMessage('');
        setFiles([]);
      },
    });

    registerCommand({
      id: 'new-line',
      phrases: ['new line', 'line break'],
      description: 'Insert a new line',
      handler: () => {
        setMessage(prev => prev + '\n');
      },
    });

    return () => {
      unregisterCommand('send-message');
      unregisterCommand('clear-input');
      unregisterCommand('new-line');
    };
  }, [enableVoiceCommands, isVoiceSupported, message, registerCommand, unregisterCommand]);

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
      e.target.value = "";
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleTyping = useEffect(() => {
    onTyping?.(message.length > 0);
  }, [message, onTyping]);

  const hasContent = message.trim().length > 0 || files.length > 0;

  // Handle voice input toggle
  const toggleVoiceInput = useCallback(async () => {
    if (isListening) {
      stopListening();
      setShowVoicePanel(false);
    } else {
      setShowVoicePanel(true);
      // Small delay to allow panel to open
      setTimeout(() => startListening(), 100);
    }
  }, [isListening, startListening, stopListening]);

  // Handle voice panel close
  const handleVoicePanelClose = useCallback(() => {
    stopListening();
    setShowVoicePanel(false);
    resetVoice();
  }, [stopListening, resetVoice]);

  // Handle voice send
  const handleVoiceSend = useCallback((transcript: string) => {
    if (transcript.trim()) {
      setMessage(prev => {
        const separator = prev && !prev.endsWith(' ') ? ' ' : '';
        return prev + separator + transcript;
      });
    }
    handleVoicePanelClose();
  }, [handleVoicePanelClose]);

  // Handle voice settings change
  const handleVoiceSettingsChange = useCallback((settings: VoiceSettings) => {
    setVoiceSettings(settings);
    onVoiceSettingsChange?.(settings);
  }, [onVoiceSettingsChange]);

  return (
    <>
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

          {/* Voice transcript preview */}
          {isListening && (
            <div className="mb-3 p-2 rounded-md bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <PulsingDot variant="recording" size="sm" isActive={true} />
                <span className="text-xs font-medium text-primary">Voice input active</span>
              </div>
              {fullTranscript && (
                <p className="text-sm">
                  {voiceTranscript && <span>{voiceTranscript}</span>}
                  {interimTranscript && (
                    <span className="text-muted-foreground">{interimTranscript}</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Input area */}
          <div className="relative flex items-end gap-2 rounded-xl border bg-muted/50 p-2 focus-within:bg-background focus-within:ring-1 focus-within:ring-ring">
            {/* Voice input button */}
            {isVoiceSupported && (
              <Button
                variant={isListening ? "destructive" : "ghost"}
                size="icon"
                className={cn(
                  "shrink-0 rounded-lg transition-all",
                  isListening && "animate-pulse"
                )}
                onClick={toggleVoiceInput}
                disabled={disabled || isLoading}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}

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

            {/* Voice settings button */}
            <VoiceSettingsPanel
              settings={voiceSettings}
              onSettingsChange={handleVoiceSettingsChange}
            >
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-lg"
                disabled={disabled || isLoading}
              >
                <Settings2 className="h-5 w-5" />
              </Button>
            </VoiceSettingsPanel>

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
            {enableVoiceCommands && isVoiceSupported && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">Say &quot;send&quot; to submit</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Voice Input Dialog */}
      <Dialog open={showVoicePanel} onOpenChange={setShowVoicePanel}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Voice Input
            </DialogTitle>
          </DialogHeader>
          <VoiceTranscriptPanel
            isListening={isListening}
            transcript={voiceTranscript}
            interimTranscript={interimTranscript}
            fullTranscript={fullTranscript}
            confidence={confidence}
            error={voiceError}
            onTranscriptChange={(text) => {
              // Update the voice transcript
            }}
            onSend={handleVoiceSend}
            onCancel={handleVoicePanelClose}
            onReset={resetVoice}
            showConfidence={voiceSettings?.showConfidenceScores ?? false}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
