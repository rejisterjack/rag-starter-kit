'use client';

/**
 * Voice React Hooks
 * Provides useVoiceInput, useVoiceOutput, useVoiceCommands, useVoiceActivity, and useWakeWord hooks
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
import {
  createVAD,
  type VADEvent,
  type VADOptions,
  type VADState,
  VoiceActivityDetector,
} from '@/lib/voice/vad';
import {
  createWakeWordDetector,
  WAKE_WORD_SETS,
  WakeWordDetector,
  type WakeWordEvent,
  type WakeWordOptions,
  type WakeWordState,
} from '@/lib/voice/wake-word';

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
      for (const unsub of unsubscribeRef.current) {
        unsub();
      }
      service.stopListening();
    };
  }, [
    autoStart,
    isSupported,
    onError,
    onFinalResult,
    onListeningStart,
    onListeningStop,
    onTranscriptChange,
    // biome-ignore lint/correctness/useExhaustiveDependencies: speechOptions spread is intentional
    speechOptions,
  ]);

  // Update configuration when options change
  useEffect(() => {
    if (serviceRef.current) {
      serviceRef.current.configure(speechOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    speechOptions.language,
    speechOptions.continuous,
    speechOptions.interimResults,
    // biome-ignore lint/correctness/useExhaustiveDependencies: speechOptions included alongside its properties
    speechOptions,
  ]);

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
    return transcript + (interimTranscript ? ` ${interimTranscript}` : '');
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
      for (const unsub of unsubscribeRef.current) {
        unsub();
      }
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
  }, [initialCommands, onCommandDetected]);

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

// =============================================================================
// useVoiceActivity Hook
// =============================================================================

export interface UseVoiceActivityOptions extends VADOptions {
  /** Auto-start VAD on mount */
  autoStart?: boolean;
  /** Callback when voice activity starts */
  onVoiceStart?: (event: VADEvent) => void;
  /** Callback when voice activity ends */
  onVoiceEnd?: (event: VADEvent) => void;
  /** Callback when noise is detected */
  onNoise?: (event: VADEvent) => void;
  /** Callback on volume change */
  onVolumeChange?: (volume: number, event: VADEvent) => void;
}

export interface UseVoiceActivityReturn {
  /** Whether VAD is currently listening */
  isListening: boolean;
  /** Whether voice is currently detected */
  isVoiceDetected: boolean;
  /** Current volume level (0-1) */
  volume: number;
  /** Duration of current voice activity in ms */
  voiceDuration: number;
  /** Duration of current silence in ms */
  silenceDuration: number;
  /** Frequency data for visualization */
  frequencyData: Uint8Array | null;
  /** Whether VAD is supported */
  isSupported: boolean;
  /** Start VAD listening */
  start: () => Promise<boolean>;
  /** Stop VAD listening */
  stop: () => void;
  /** Update VAD options */
  updateOptions: (options: Partial<VADOptions>) => void;
}

export function useVoiceActivity(options: UseVoiceActivityOptions = {}): UseVoiceActivityReturn {
  const {
    autoStart = false,
    onVoiceStart,
    onVoiceEnd,
    onNoise,
    onVolumeChange,
    ...vadOptions
  } = options;

  const [state, setState] = useState<VADState>({
    isVoiceDetected: false,
    isListening: false,
    volume: 0,
    voiceDuration: 0,
    silenceDuration: 0,
  });
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);

  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const unsubRef = useRef<(() => void)[]>([]);

  const isSupported = useMemo(() => VoiceActivityDetector.isSupported(), []);

  // Initialize VAD
  useEffect(() => {
    if (!isSupported) return;

    const vad = createVAD(vadOptions);
    vadRef.current = vad;

    // Subscribe to state changes
    const unsubState = vad.onStateChange((newState) => {
      setState(newState);
    });

    // Subscribe to events
    const unsubVoiceStart = vad.on('voice-start', (event) => {
      setFrequencyData(event.frequencyData || null);
      onVoiceStart?.(event);
    });

    const unsubVoiceEnd = vad.on('voice-end', (event) => {
      setFrequencyData(event.frequencyData || null);
      onVoiceEnd?.(event);
    });

    const unsubNoise = onNoise ? vad.on('noise', onNoise) : () => {};

    const unsubVolume = onVolumeChange
      ? vad.on('volume', (event) => {
          setFrequencyData(event.frequencyData || null);
          onVolumeChange(event.volume, event);
        })
      : () => {};

    unsubRef.current = [unsubState, unsubVoiceStart, unsubVoiceEnd, unsubNoise, unsubVolume];

    // Auto-start if enabled
    if (autoStart) {
      void vad.start();
    }

    return () => {
      for (const unsub of unsubRef.current) {
        unsub();
      }
      vad.destroy();
      vadRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: vadOptions spread is intentional
  }, [isSupported, autoStart, onNoise, onVoiceEnd, onVoiceStart, onVolumeChange, vadOptions]);

  // Update options when they change
  useEffect(() => {
    if (vadRef.current) {
      vadRef.current.updateOptions(vadOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: vadOptions object is stable
  }, [vadOptions]);

  const start = useCallback(async () => {
    if (vadRef.current) {
      return await vadRef.current.start();
    }
    return false;
  }, []);

  const stop = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.stop();
    }
  }, []);

  const updateOptions = useCallback((newOptions: Partial<VADOptions>) => {
    if (vadRef.current) {
      vadRef.current.updateOptions(newOptions);
    }
  }, []);

  return {
    isListening: state.isListening,
    isVoiceDetected: state.isVoiceDetected,
    volume: state.volume,
    voiceDuration: state.voiceDuration,
    silenceDuration: state.silenceDuration,
    frequencyData,
    isSupported,
    start,
    stop,
    updateOptions,
  };
}

// =============================================================================
// useWakeWord Hook
// =============================================================================

export interface UseWakeWordOptions extends WakeWordOptions {
  /** Auto-start wake word detection on mount */
  autoStart?: boolean;
  /** Callback when wake word is detected */
  onWake?: (event: WakeWordEvent) => void;
  /** Callback when listening starts */
  onListening?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface UseWakeWordReturn {
  /** Whether wake word detection is active */
  isListening: boolean;
  /** Whether in low-power mode */
  isLowPowerMode: boolean;
  /** Number of wake words detected */
  wakeCount: number;
  /** Last detected wake word */
  lastWakeWord: string | null;
  /** Time of last wake word detection */
  lastWakeTime: number | null;
  /** Whether wake word detection is supported */
  isSupported: boolean;
  /** Whether low-power mode is supported */
  isLowPowerSupported: boolean;
  /** Start detection */
  start: () => Promise<boolean>;
  /** Stop detection */
  stop: () => void;
  /** Pause detection temporarily */
  pause: () => void;
  /** Resume detection after pause */
  resume: () => void;
  /** Add a wake word */
  addWakeWord: (wakeWord: string) => void;
  /** Remove a wake word */
  removeWakeWord: (wakeWord: string) => void;
  /** Get current wake words */
  getWakeWords: () => string[];
  /** Set wake words */
  setWakeWords: (wakeWords: string[]) => void;
}

export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordReturn {
  const { autoStart = false, onWake, onListening, onError, ...wakeWordOptions } = options;

  const [state, setState] = useState<WakeWordState>({
    isListening: false,
    isLowPowerMode: false,
    wakeCount: 0,
    lastWakeWord: null,
    lastWakeTime: null,
  });

  const detectorRef = useRef<WakeWordDetector | null>(null);
  const unsubRef = useRef<(() => void)[]>([]);

  const isSupported = useMemo(() => WakeWordDetector.isSupported(), []);
  const isLowPowerSupported = useMemo(() => WakeWordDetector.isLowPowerModeSupported(), []);

  // Initialize detector
  useEffect(() => {
    if (!isSupported) return;

    const detector = createWakeWordDetector(wakeWordOptions);
    detectorRef.current = detector;

    // Subscribe to state changes
    const unsubState = detector.onStateChange((newState) => {
      setState(newState);
    });

    // Subscribe to events
    const unsubWake = onWake ? detector.onWake(onWake) : () => {};

    const unsubListening = onListening ? detector.on('listening', onListening) : () => {};

    const unsubError = onError
      ? detector.on('error', (event) => {
          if (event.error) onError(event.error);
        })
      : () => {};

    unsubRef.current = [unsubState, unsubWake, unsubListening, unsubError];

    // Auto-start if enabled
    if (autoStart) {
      void detector.start();
    }

    return () => {
      for (const unsub of unsubRef.current) {
        unsub();
      }
      detector.destroy();
      detectorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: wakeWordOptions spread is intentional
  }, [isSupported, autoStart, onError, onListening, onWake, wakeWordOptions]);

  // Update options when they change (excluding callback-related options)
  useEffect(() => {
    if (detectorRef.current) {
      detectorRef.current.updateOptions(wakeWordOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: wakeWordOptions object is stable
  }, [wakeWordOptions]);

  const start = useCallback(async () => {
    if (detectorRef.current) {
      return await detectorRef.current.start();
    }
    return false;
  }, []);

  const stop = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.stop();
    }
  }, []);

  const pause = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.resume();
    }
  }, []);

  const addWakeWord = useCallback((wakeWord: string) => {
    if (detectorRef.current) {
      detectorRef.current.addWakeWord(wakeWord);
    }
  }, []);

  const removeWakeWord = useCallback((wakeWord: string) => {
    if (detectorRef.current) {
      detectorRef.current.removeWakeWord(wakeWord);
    }
  }, []);

  const getWakeWords = useCallback(() => {
    if (detectorRef.current) {
      return detectorRef.current.getWakeWords();
    }
    return [];
  }, []);

  const setWakeWords = useCallback((wakeWords: string[]) => {
    if (detectorRef.current) {
      detectorRef.current.setWakeWords(wakeWords);
    }
  }, []);

  return {
    isListening: state.isListening,
    isLowPowerMode: state.isLowPowerMode,
    wakeCount: state.wakeCount,
    lastWakeWord: state.lastWakeWord,
    lastWakeTime: state.lastWakeTime,
    isSupported,
    isLowPowerSupported,
    start,
    stop,
    pause,
    resume,
    addWakeWord,
    removeWakeWord,
    getWakeWords,
    setWakeWords,
  };
}

// Export wake word sets for convenience
export { WAKE_WORD_SETS };
