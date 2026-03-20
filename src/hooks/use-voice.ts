'use client';

/**
 * Voice React Hooks
 * Provides useVoiceInput, useVoiceOutput, and useVoiceCommands hooks
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AudioLevelData,
  getSpeechService,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  type SpeechRecognitionError,
  type SpeechRecognitionOptions,
  type SpeechService,
  type TTSSynthesisOptions,
  type TTSVoice,
  type UseVoiceCommandsReturn,
  type UseVoiceInputReturn,
  type UseVoiceOutputReturn,
  type VoiceCommand,
} from '@/lib/voice';

// =============================================================================
// useVoiceInput Hook
// =============================================================================

interface UseVoiceInputOptions extends SpeechRecognitionOptions {
  /** Callback when transcript changes */
  onTranscriptChange?: (transcript: string) => void;
  /** Callback when final result is received */
  onFinalResult?: (transcript: string) => void;
  /** Callback when error occurs */
  onError?: (error: SpeechRecognitionError) => void;
  /** Auto-start listening on mount */
  autoStart?: boolean;
  /** Callback when listening starts */
  onListeningStart?: () => void;
  /** Callback when listening stops */
  onListeningStop?: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    onTranscriptChange,
    onFinalResult,
    onError,
    autoStart = false,
    onListeningStart,
    onListeningStop,
    ...speechOptions
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<SpeechRecognitionError | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  const serviceRef = useRef<SpeechService | null>(null);
  const unsubscribeRef = useRef<(() => void)[]>([]);

  const isSupported = useMemo(() => isSpeechRecognitionSupported(), []);

  // Initialize service
  useEffect(() => {
    if (!isSupported) return;

    serviceRef.current = getSpeechService();
    const service = serviceRef.current;

    // Configure service
    service.configure(speechOptions);

    // Subscribe to events
    const unsubStart = service.on('recognition:start', () => {
      setIsListening(true);
      setError(null);
      onListeningStart?.();
    });

    const unsubEnd = service.on('recognition:end', () => {
      setIsListening(false);
      setInterimTranscript('');
      onListeningStop?.();
    });

    const unsubResult = service.on('recognition:result', (data: unknown) => {
      const result = data as {
        transcript: string;
        fullTranscript: string;
        interimTranscript: string;
        isFinal: boolean;
        confidence: number | null;
      };

      setTranscript(result.fullTranscript);
      setInterimTranscript(result.interimTranscript);

      if (result.confidence !== null) {
        setConfidence(result.confidence);
      }

      onTranscriptChange?.(result.fullTranscript);

      if (result.isFinal) {
        onFinalResult?.(result.transcript);
      }
    });

    const unsubError = service.on('recognition:error', (data: unknown) => {
      const err = data as SpeechRecognitionError;
      setError(err);
      setIsListening(false);
      onError?.(err);
    });

    unsubscribeRef.current = [unsubStart, unsubEnd, unsubResult, unsubError];

    // Auto-start if enabled
    if (autoStart) {
      service.startListening();
    }

    return () => {
      unsubscribeRef.current.forEach((unsub) => unsub());
      service.stopListening();
    };
  }, []);

  // Update configuration when options change
  useEffect(() => {
    if (serviceRef.current) {
      serviceRef.current.configure(speechOptions);
    }
  }, [speechOptions.language, speechOptions.continuous, speechOptions.interimResults]);

  const startListening = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.startListening();
    }
  }, []);

  const stopListening = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.stopListening();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setConfidence(null);
  }, []);

  const setTranscriptManually = useCallback((newTranscript: string) => {
    setTranscript(newTranscript);
  }, []);

  const fullTranscript = useMemo(() => {
    return transcript + (interimTranscript ? ' ' + interimTranscript : '');
  }, [transcript, interimTranscript]);

  return {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript: fullTranscript.trim(),
    error,
    confidence,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    reset,
    setTranscript: setTranscriptManually,
  };
}

// =============================================================================
// useVoiceOutput Hook
// =============================================================================

interface UseVoiceOutputOptions {
  /** Default voice URI */
  defaultVoice?: string;
  /** Default speech rate */
  defaultRate?: number;
  /** Default speech pitch */
  defaultPitch?: number;
  /** Default volume */
  defaultVolume?: number;
  /** Callback when speaking starts */
  onSpeakingStart?: () => void;
  /** Callback when speaking ends */
  onSpeakingEnd?: () => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
  /** Callback on word boundary */
  onBoundary?: (charIndex: number, charLength: number) => void;
}

export function useVoiceOutput(options: UseVoiceOutputOptions = {}): UseVoiceOutputReturn {
  const {
    defaultVoice,
    defaultRate = 1,
    defaultPitch = 1,
    defaultVolume = 1,
    onSpeakingStart,
    onSpeakingEnd,
    onError,
    onBoundary,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [currentVoice, setCurrentVoiceState] = useState<TTSVoice | null>(null);
  const [rate, setRateState] = useState(defaultRate);
  const [pitch, setPitchState] = useState(defaultPitch);

  const serviceRef = useRef<SpeechService | null>(null);
  const unsubscribeRef = useRef<(() => void)[]>([]);
  const optionsRef = useRef({ defaultVoice, defaultRate, defaultPitch, defaultVolume });

  const isSupported = useMemo(() => isSpeechSynthesisSupported(), []);

  // Update options ref when props change
  useEffect(() => {
    optionsRef.current = { defaultVoice, defaultRate, defaultPitch, defaultVolume };
  }, [defaultVoice, defaultRate, defaultPitch, defaultVolume]);

  // Initialize service and load voices
  useEffect(() => {
    if (!isSupported) return;

    const service = getSpeechService();
    serviceRef.current = service;

    // Load voices
    const loadVoices = () => {
      const availableVoices = service.getVoices();
      setVoices(availableVoices);

      // Set default voice
      if (optionsRef.current.defaultVoice) {
        const voice = availableVoices.find((v) => v.voiceURI === optionsRef.current.defaultVoice);
        if (voice) {
          setCurrentVoiceState(voice);
        }
      } else {
        // Try to find a good default voice for the current language
        const defaultVoice = availableVoices.find((v) => v.default) || availableVoices[0];
        if (defaultVoice) {
          setCurrentVoiceState(defaultVoice);
        }
      }
    };

    // Load voices immediately and when they change
    loadVoices();

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Subscribe to events
    const unsubStart = service.on('synthesis:start', () => {
      setIsSpeaking(true);
      setIsPaused(false);
      onSpeakingStart?.();
    });

    const unsubEnd = service.on('synthesis:end', () => {
      setIsSpeaking(false);
      setIsPaused(false);
      onSpeakingEnd?.();
    });

    const unsubError = service.on('synthesis:error', (data: unknown) => {
      const err = data as { error: string };
      setIsSpeaking(false);
      setIsPaused(false);
      onError?.(err.error);
    });

    const unsubPause = service.on('synthesis:pause', () => {
      setIsPaused(true);
    });

    const unsubResume = service.on('synthesis:resume', () => {
      setIsPaused(false);
    });

    const unsubBoundary = service.on('synthesis:boundary', (data: unknown) => {
      const boundary = data as { charIndex: number; charLength: number };
      onBoundary?.(boundary.charIndex, boundary.charLength);
    });

    unsubscribeRef.current = [
      unsubStart,
      unsubEnd,
      unsubError,
      unsubPause,
      unsubResume,
      unsubBoundary,
    ];

    return () => {
      unsubscribeRef.current.forEach((unsub) => unsub());
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
      service.cancel();
    };
  }, [isSupported, onSpeakingStart, onSpeakingEnd, onError, onBoundary]);

  const speak = useCallback(
    (text: string, speakOptions: Partial<TTSSynthesisOptions> = {}) => {
      if (!serviceRef.current) return;

      serviceRef.current.speak(text, {
        voice: speakOptions.voice || currentVoice || undefined,
        rate: speakOptions.rate ?? rate,
        pitch: speakOptions.pitch ?? pitch,
        volume: speakOptions.volume ?? optionsRef.current.defaultVolume,
        lang: speakOptions.lang,
      });
    },
    [currentVoice, rate, pitch]
  );

  const cancel = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.cancel();
    }
  }, []);

  const pause = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.resume();
    }
  }, []);

  const setVoice = useCallback(
    (voiceURI: string) => {
      const voice = voices.find((v) => v.voiceURI === voiceURI);
      if (voice) {
        setCurrentVoiceState(voice);
      }
    },
    [voices]
  );

  const setRate = useCallback((newRate: number) => {
    setRateState(Math.max(0.1, Math.min(10, newRate)));
  }, []);

  const setPitch = useCallback((newPitch: number) => {
    setPitchState(Math.max(0, Math.min(2, newPitch)));
  }, []);

  return {
    isSpeaking,
    isPaused,
    voices,
    currentVoice,
    isSupported,
    speak,
    cancel,
    pause,
    resume,
    setVoice,
    setRate,
    setPitch,
  };
}

// =============================================================================
// useVoiceCommands Hook
// =============================================================================

interface UseVoiceCommandsOptions {
  /** Whether voice commands are enabled by default */
  enabled?: boolean;
  /** Callback when a command is detected */
  onCommandDetected?: (commandId: string, transcript: string) => void;
  /** Commands to register on init */
  initialCommands?: Array<Omit<VoiceCommand, 'handler'> & { handler: (args?: string) => void }>;
}

export function useVoiceCommands(options: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn {
  const { enabled: initialEnabled = true, onCommandDetected, initialCommands = [] } = options;

  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);

  const serviceRef = useRef<SpeechService | null>(null);
  const handlersRef = useRef<Map<string, (args?: string) => void>>(new Map());

  // Initialize service
  useEffect(() => {
    const service = getSpeechService();
    serviceRef.current = service;

    // Register initial commands
    initialCommands.forEach((cmd) => {
      handlersRef.current.set(cmd.id, cmd.handler);
      service.registerCommand({
        ...cmd,
        handler: cmd.handler,
      });
    });

    setCommands([...initialCommands]);

    // Subscribe to command detection
    const unsub = service.on('command:detected', (data: unknown) => {
      const event = data as { commandId: string; transcript: string };
      setLastCommand(event.commandId);
      onCommandDetected?.(event.commandId, event.transcript);
    });

    return () => {
      unsub();
      service.clearCommands();
    };
  }, []);

  const registerCommand = useCallback(
    (command: Omit<VoiceCommand, 'handler'> & { handler: (args?: string) => void }) => {
      if (!serviceRef.current) return;

      // Store handler reference
      handlersRef.current.set(command.id, command.handler);

      // Create wrapper that checks if enabled
      const wrapperHandler = (args?: string) => {
        if (isEnabled) {
          command.handler(args);
        }
      };

      const voiceCommand: VoiceCommand = {
        ...command,
        handler: wrapperHandler,
      };

      serviceRef.current.registerCommand(voiceCommand);
      setCommands((prev) => [...prev.filter((c) => c.id !== command.id), voiceCommand]);
    },
    [isEnabled]
  );

  const unregisterCommand = useCallback((id: string) => {
    if (!serviceRef.current) return;

    serviceRef.current.unregisterCommand(id);
    handlersRef.current.delete(id);
    setCommands((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  const getHelpText = useCallback(() => {
    if (commands.length === 0) {
      return 'No voice commands registered.';
    }

    return commands
      .map((cmd) => {
        const phrases = cmd.phrases.map((p) => `"${p}"`).join(', ');
        return `${cmd.description}: Say ${phrases}`;
      })
      .join('\n');
  }, [commands]);

  return {
    commands,
    lastCommand,
    isEnabled,
    registerCommand,
    unregisterCommand,
    setEnabled,
    getHelpText,
  };
}

// =============================================================================
// useAudioLevel Hook
// =============================================================================

interface UseAudioLevelReturn {
  /** Current audio level (0-1) */
  level: number;
  /** Whether audio is currently detected above threshold */
  isSpeaking: boolean;
  /** Frequency data for visualization */
  frequencyData: Uint8Array | null;
}

export function useAudioLevel(enabled: boolean = true): UseAudioLevelReturn {
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);

  const serviceRef = useRef<SpeechService | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      setIsSpeaking(false);
      return;
    }

    const service = getSpeechService();
    serviceRef.current = service;

    const unsub = service.on('audiometer:update', (data: unknown) => {
      const audioData = data as AudioLevelData;
      setLevel(audioData.level);
      setIsSpeaking(audioData.isSpeaking);
      setFrequencyData(audioData.frequencyData || null);
    });

    return () => {
      unsub();
    };
  }, [enabled]);

  return {
    level,
    isSpeaking,
    frequencyData,
  };
}
