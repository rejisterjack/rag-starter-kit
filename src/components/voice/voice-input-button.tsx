'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { VoiceWaveform } from './voice-waveform';

interface VoiceInputButtonProps {
  onTranscript: (transcript: string) => void;
  onCancel?: () => void;
  language?: string;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({
  onTranscript,
  onCancel,
  language = 'en-US',
  disabled = false,
  className,
}: VoiceInputButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const {
    state,
    transcript,
    interimTranscript,
    confidence,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setLanguage,
  } = useSpeechRecognition({
    language,
    onResult: (text, isFinal) => {
      if (isFinal && confidence > 0.7) {
        // Auto-send if high confidence
        // onTranscript(text);
      }
    },
    onError: () => {
      setShowConfirm(false);
    },
  });

  // Update language when prop changes
  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);

  const isListening = state === 'listening' || state === 'starting';

  const handleStart = useCallback(() => {
    resetTranscript();
    setShowConfirm(true);
    startListening();
  }, [resetTranscript, startListening]);

  const handleStop = useCallback(() => {
    stopListening();
    setShowConfirm(false);
    if (transcript) {
      onTranscript(transcript);
    }
  }, [stopListening, transcript, onTranscript]);

  const handleCancel = useCallback(() => {
    stopListening();
    resetTranscript();
    setShowConfirm(false);
    onCancel?.();
  }, [stopListening, resetTranscript, onCancel]);

  const handleSend = useCallback(() => {
    const fullTranscript = transcript + interimTranscript;
    if (fullTranscript.trim()) {
      onTranscript(fullTranscript.trim());
    }
    handleCancel();
  }, [transcript, interimTranscript, onTranscript, handleCancel]);

  if (!isSupported) {
    return null;
  }

  // Show confirmation UI when listening
  if (showConfirm) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 animate-in fade-in zoom-in-95",
        error && "border-red-500 bg-red-50 dark:bg-red-950/20",
        className
      )}>
        <VoiceWaveform isActive={isListening} className="h-5 w-8" />
        
        <span className="max-w-[200px] truncate text-sm text-muted-foreground">
          {transcript || interimTranscript || (
            state === 'starting' ? 'Starting...' : 'Listening...'
          )}
        </span>
        
        {error && (
          <span className="text-xs text-red-500">{error.message}</span>
        )}
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-red-500 hover:bg-red-100 hover:text-red-600"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-green-500 hover:bg-green-100 hover:text-green-600"
            onClick={handleSend}
            disabled={!transcript && !interimTranscript}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full transition-all duration-300",
              isListening && "bg-red-100 text-red-600 animate-pulse",
              className
            )}
            onClick={handleStart}
            disabled={disabled || state === 'starting'}
          >
            {state === 'starting' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isListening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isListening ? 'Stop recording' : 'Voice input'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VoiceInputButton;
