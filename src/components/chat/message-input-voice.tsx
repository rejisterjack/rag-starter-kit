'use client';

/**
 * Enhanced Message Input with Voice Support
 * Extension of the base MessageInput component with voice input capabilities
 */

import { Loader2, Mic, Paperclip, Send, Settings2, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { VoiceSettingsPanel } from '@/components/voice/voice-settings';
import { VoiceTranscriptPanel } from '@/components/voice/voice-transcript-panel';
import { PulsingDot } from '@/components/voice/voice-waveform';
import { useVoiceCommands, useVoiceInput } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import type { VoiceSettings } from '@/lib/voice';

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
  placeholder = 'Send a message...',
  className,
  defaultVoiceSettings,
  onVoiceSettingsChange,
  enableVoiceCommands = true,
}: MessageInputVoiceProps) {
  const [message, setMessage] = useState('');
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
      setMessage((prev) => {
        const separator = prev && !prev.endsWith(' ') ? ' ' : '';
        return prev + separator + finalTranscript;
      });
    }, []),
  });

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  // Define handleSubmit early to avoid TDZ issues with voice commands
  const handleSubmit = useCallback(() => {
    if (!message.trim() && files.length === 0) return;
    if (disabled || isLoading) return;

    onSend(message.trim(), files.length > 0 ? files : undefined);
    setMessage('');
    setFiles([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, files, disabled, isLoading, onSend]);

  // Voice commands - defined after handleSubmit to avoid temporal dead zone
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
        setMessage((prev) => `${prev}\n`);
      },
    });

    return () => {
      unregisterCommand('send-message');
      unregisterCommand('clear-input');
      unregisterCommand('new-line');
    };
  }, [
    enableVoiceCommands,
    isVoiceSupported,
    message,
    registerCommand,
    unregisterCommand,
    handleSubmit,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
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
  const handleVoiceSend = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        setMessage((prev) => {
          const separator = prev && !prev.endsWith(' ') ? ' ' : '';
          return prev + separator + transcript;
        });
      }
      handleVoicePanelClose();
    },
    [handleVoicePanelClose]
  );

  // Handle voice settings change
  const handleVoiceSettingsChange = useCallback(
    (settings: VoiceSettings) => {
      setVoiceSettings(settings);
      onVoiceSettingsChange?.(settings);
    },
    [onVoiceSettingsChange]
  );

  return (
    <>
      <div className={cn('border-t bg-background p-4', className)}>
        <div className="mx-auto max-w-3xl">
          {/* File attachments */}
          {files.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {files.map((file, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
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
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              className="max-h-[200px] min-h-[60px] resize-none pr-24"
              rows={1}
            />

            {/* Action buttons */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {/* Voice input button */}
              {isVoiceSupported && (
                <Button
                  variant={isListening ? 'default' : 'ghost'}
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-full',
                    isListening && 'animate-pulse bg-red-500 hover:bg-red-600'
                  )}
                  onClick={toggleVoiceInput}
                  disabled={disabled}
                  title="Voice input"
                >
                  {isListening ? <PulsingDot className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}

              {/* File attachment */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => document.getElementById('file-input')?.click()}
                disabled={disabled || isLoading}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                id="file-input"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.md"
              />

              {/* Send button */}
              <Button
                variant="default"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleSubmit}
                disabled={!hasContent || disabled || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Voice settings */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setShowVoicePanel(true)}
              >
                <Settings2 className="h-3 w-3" />
                Voice Settings
              </Button>
            </div>

            {voiceError && (
              <span className="text-xs text-destructive">Voice error: {voiceError.message}</span>
            )}
          </div>
        </div>
      </div>

      {/* Voice transcript panel */}
      <VoiceTranscriptPanel
        isOpen={showVoicePanel}
        onClose={handleVoicePanelClose}
        transcript={voiceTranscript}
        interimTranscript={interimTranscript}
        fullTranscript={fullTranscript}
        confidence={confidence}
        isListening={isListening}
        onSend={handleVoiceSend}
        error={voiceError ?? null}
      />

      {/* Voice Settings Dialog */}
      <Dialog
        open={showVoicePanel && !isListening}
        onOpenChange={(open) => !open && setShowVoicePanel(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Settings</DialogTitle>
          </DialogHeader>
          <VoiceSettingsPanel settings={voiceSettings} onSettingsChange={handleVoiceSettingsChange} />
        </DialogContent>
      </Dialog>
    </>
  );
}
