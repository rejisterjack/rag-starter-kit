'use client';

/**
 * Speak Button Component
 * Speaker button to read text aloud with play/stop functionality
 */

import { Loader2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useVoiceOutput } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import type { SupportedLanguage } from '@/lib/voice';

interface SpeakButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Text to speak */
  text: string;
  /** Language for speech synthesis */
  language?: SupportedLanguage;
  /** Speech rate (0.5 - 2) */
  rate?: number;
  /** Speech pitch (0 - 2) */
  pitch?: number;
  /** Whether to auto-play on mount */
  autoPlay?: boolean;
  /** Callback when speaking starts */
  onSpeakStart?: () => void;
  /** Callback when speaking ends */
  onSpeakEnd?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Button variant */
  buttonVariant?: ButtonProps['variant'];
  /** Button size */
  buttonSize?: ButtonProps['size'];
  /** Whether to show as icon only */
  iconOnly?: boolean;
  /** Whether to allow pause/resume */
  allowPause?: boolean;
  /** Custom label text */
  label?: string;
}

export function SpeakButton({
  text,
  language,
  rate = 1,
  pitch = 1,
  autoPlay = false,
  onSpeakStart,
  onSpeakEnd,
  className,
  buttonVariant = 'ghost',
  buttonSize = 'icon',
  iconOnly = true,
  allowPause = false,
  label,
  disabled,
  ...props
}: SpeakButtonProps) {
  const { isSpeaking, isPaused, isSupported, speak, cancel, pause, resume } = useVoiceOutput({
    defaultRate: rate,
    defaultPitch: pitch,
    onSpeakingStart: onSpeakStart,
    onSpeakingEnd: onSpeakEnd,
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSpeak = useCallback(() => {
    if (!isSupported) return;

    setIsLoading(true);

    // Clean text for speech (remove markdown, etc.)
    const cleanText = text
      .replace(/[#*_`~[\]()|-]/g, '') // Remove markdown characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    speak(cleanText, {
      lang: language,
    });

    setIsLoading(false);
  }, [isSupported, text, language, speak]);

  // Auto-play on mount if enabled
  useEffect(() => {
    if (autoPlay && isSupported && text) {
      handleSpeak();
    }
  }, [autoPlay, isSupported, text, handleSpeak]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const handleToggle = useCallback(() => {
    if (isSpeaking) {
      cancel();
    } else {
      handleSpeak();
    }
  }, [isSpeaking, cancel, handleSpeak]);

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPaused, resume, pause]);

  // Get appropriate icon
  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    if (isSpeaking) {
      if (allowPause && isPaused) {
        return <Play className="h-4 w-4" />;
      }
      return <VolumeX className="h-4 w-4" />;
    }

    return <Volume2 className="h-4 w-4" />;
  };

  // Get tooltip text
  const getTooltipText = () => {
    if (!isSupported) return 'Text-to-speech not supported';
    if (isSpeaking) {
      if (allowPause && isPaused) return 'Resume speaking';
      return 'Stop speaking';
    }
    return 'Read aloud';
  };

  // Get ARIA label
  const getAriaLabel = () => {
    if (isSpeaking) {
      return isPaused ? 'Resume speaking' : 'Stop speaking';
    }
    return `Read message aloud: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`;
  };

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={buttonVariant}
              size={buttonSize}
              disabled
              className={cn('opacity-50', className)}
              aria-label="Text-to-speech not supported"
              {...props}
            >
              <VolumeX className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Text-to-speech not supported in this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-1', className)}>
            <Button
              variant={isSpeaking ? 'secondary' : buttonVariant}
              size={buttonSize}
              onClick={handleToggle}
              disabled={disabled || !text}
              className={cn(
                'transition-all duration-200',
                isSpeaking && 'bg-primary/10 text-primary'
              )}
              aria-label={getAriaLabel()}
              aria-pressed={isSpeaking}
              {...props}
            >
              {getIcon()}
              {!iconOnly && <span className="ml-2">{isSpeaking ? 'Stop' : label || 'Speak'}</span>}
            </Button>

            {/* Pause button */}
            {allowPause && isSpeaking && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePauseToggle}
                className="h-8 w-8"
                aria-label={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Speak Text Component (Inline)
// =============================================================================

interface SpeakTextProps {
  /** Text to speak */
  text: string;
  /** Whether to show button */
  showButton?: boolean;
  /** Whether to auto-play */
  autoPlay?: boolean;
  /** Language */
  language?: SupportedLanguage;
  /** Rate */
  rate?: number;
  /** Additional classes */
  className?: string;
}

export function SpeakText({
  text,
  showButton = true,
  autoPlay = false,
  language,
  rate,
  className,
}: SpeakTextProps) {
  const { speak, cancel } = useVoiceOutput({
    defaultRate: rate,
  });

  useEffect(() => {
    if (autoPlay) {
      const cleanText = text.replace(/[#*_`~[\]()|-]/g, '').trim();
      speak(cleanText, { lang: language });
    }

    return () => {
      cancel();
    };
  }, [autoPlay, text, language, speak, cancel]);

  if (!showButton) return null;

  return <SpeakButton text={text} language={language} rate={rate} className={className} />;
}

// =============================================================================
// Voice Message Reader
// =============================================================================

interface VoiceMessageReaderProps {
  /** Array of messages to read */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Current message index to read */
  currentIndex?: number;
  /** Whether to auto-read new assistant messages */
  autoRead?: boolean;
  /** Language */
  language?: SupportedLanguage;
  /** Rate */
  rate?: number;
  /** Callback when finished reading all */
  onFinish?: () => void;
  /** Callback when reading message */
  onReadMessage?: (index: number) => void;
}

export function VoiceMessageReader({
  messages,
  currentIndex,
  autoRead = false,
  language,
  rate = 1,
  onFinish,
  onReadMessage,
}: VoiceMessageReaderProps) {
  const [readingIndex, setReadingIndex] = useState<number | null>(null);

  const { isSpeaking, speak } = useVoiceOutput({
    defaultRate: rate,
    onSpeakingEnd: () => {
      if (readingIndex !== null && readingIndex < messages.length - 1) {
        // Continue to next assistant message
        const nextIndex = findNextAssistantMessage(readingIndex + 1);
        if (nextIndex !== -1) {
          setReadingIndex(nextIndex);
          onReadMessage?.(nextIndex);
          readMessage(nextIndex);
        } else {
          setReadingIndex(null);
          onFinish?.();
        }
      } else {
        setReadingIndex(null);
        onFinish?.();
      }
    },
  });

  const findNextAssistantMessage = (fromIndex: number): number => {
    for (let i = fromIndex; i < messages.length; i++) {
      if (messages[i]?.role === 'assistant') {
        return i;
      }
    }
    return -1;
  };

  const readMessage = useCallback(
    (index: number) => {
      const message = messages[index];
      if (!message || message.role !== 'assistant') return;

      const cleanText = message.content
        .replace(/[#*_`~[\]()|-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      speak(cleanText, { lang: language });
    },
    [messages, language, speak]
  );

  // Auto-read when new assistant message arrives
  useEffect(() => {
    if (!autoRead) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && !isSpeaking) {
      const index = messages.length - 1;
      setReadingIndex(index);
      readMessage(index);
    }
  }, [messages, autoRead, isSpeaking, readMessage]);

  // Handle manual currentIndex change
  useEffect(() => {
    if (currentIndex !== undefined && currentIndex !== readingIndex) {
      setReadingIndex(currentIndex);
      readMessage(currentIndex);
    }
  }, [currentIndex, readingIndex, readMessage]);

  return null; // This is a logic-only component
}
