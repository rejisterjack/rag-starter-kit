/**
 * React Hook for Text-to-Speech
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TextToSpeechService,
  TextToSpeechOptions,
  isTextToSpeechSupported,
  findBestVoice,
  VOICE_PRESETS,
  VoicePreset,
} from '@/lib/voice/text-to-speech';

export type TTSEventType = 'start' | 'end' | 'pause' | 'resume' | 'error' | 'boundary';

export interface UseTextToSpeechReturn {
  // State
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  
  // Settings
  rate: number;
  pitch: number;
  volume: number;
  
  // Actions
  speak: (text: string, options?: Partial<TextToSpeechOptions>) => Promise<void>;
  speakImmediately: (text: string, options?: Partial<TextToSpeechOptions>) => Promise<void>;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  stop: () => void;
  clearQueue: () => void;
  
  // Settings
  setVoice: (voice: SpeechSynthesisVoice | null) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  applyPreset: (preset: VoicePreset) => void;
  
  // Helpers
  findVoiceForLanguage: (lang: string) => SpeechSynthesisVoice | null;
  queueLength: number;
}

export interface UseTextToSpeechOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  preferPremium?: boolean;
}

export function useTextToSpeech(
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(
    options.voice || null
  );
  const [rate, setRateState] = useState(options.rate ?? 1);
  const [pitch, setPitchState] = useState(options.pitch ?? 1);
  const [volume, setVolumeState] = useState(options.volume ?? 1);
  const [queueLength, setQueueLength] = useState(0);
  
  const serviceRef = useRef<TextToSpeechService | null>(null);
  const isSupported = isTextToSpeechSupported();

  // Initialize service
  useEffect(() => {
    if (!isSupported) return;

    const service = new TextToSpeechService();
    serviceRef.current = service;

    // Load voices
    service.waitForVoices().then(() => {
      const availableVoices = service.getVoices();
      setVoices(availableVoices);

      // Select best voice if none selected
      if (!selectedVoice) {
        const bestVoice = options.lang
          ? findBestVoice(availableVoices, options.lang, options.preferPremium)
          : service.getDefaultVoice();
        setSelectedVoice(bestVoice);
      }
    });

    // Bind events
    service.on('start', () => {
      setIsSpeaking(true);
      setIsPaused(false);
      options.onStart?.();
    });

    service.on('end', () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setQueueLength(service.getQueueLength());
      options.onEnd?.();
    });

    service.on('pause', () => {
      setIsPaused(true);
    });

    service.on('resume', () => {
      setIsPaused(false);
    });

    service.on('error', (event) => {
      setIsSpeaking(false);
      const error = new Error(`Speech synthesis error: ${event.error}`);
      options.onError?.(error);
    });

    return () => {
      service.destroy();
    };
  }, [isSupported]);

  // Update queue length periodically
  useEffect(() => {
    if (!serviceRef.current) return;

    const interval = setInterval(() => {
      setQueueLength(serviceRef.current?.getQueueLength() || 0);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const speak = useCallback(
    async (text: string, overrideOptions?: Partial<TextToSpeechOptions>) => {
      if (!serviceRef.current) return;

      const ttsOptions: TextToSpeechOptions = {
        voice: overrideOptions?.voice || selectedVoice || undefined,
        rate: overrideOptions?.rate ?? rate,
        pitch: overrideOptions?.pitch ?? pitch,
        volume: overrideOptions?.volume ?? volume,
        lang: overrideOptions?.lang || options.lang,
      };

      await serviceRef.current.speak(text, ttsOptions);
    },
    [selectedVoice, rate, pitch, volume, options.lang]
  );

  const speakImmediately = useCallback(
    async (text: string, overrideOptions?: Partial<TextToSpeechOptions>) => {
      if (!serviceRef.current) return;

      const ttsOptions: TextToSpeechOptions = {
        voice: overrideOptions?.voice || selectedVoice || undefined,
        rate: overrideOptions?.rate ?? rate,
        pitch: overrideOptions?.pitch ?? pitch,
        volume: overrideOptions?.volume ?? volume,
        lang: overrideOptions?.lang || options.lang,
      };

      await serviceRef.current.speakImmediately(text, ttsOptions);
    },
    [selectedVoice, rate, pitch, volume, options.lang]
  );

  const pause = useCallback(() => {
    serviceRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    serviceRef.current?.resume();
  }, []);

  const togglePause = useCallback(() => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPaused, pause, resume]);

  const stop = useCallback(() => {
    serviceRef.current?.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const clearQueue = useCallback(() => {
    serviceRef.current?.clearQueue();
    setQueueLength(0);
  }, []);

  const setVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
    setSelectedVoice(voice);
  }, []);

  const setRate = useCallback((newRate: number) => {
    setRateState(Math.max(0.1, Math.min(2, newRate)));
  }, []);

  const setPitch = useCallback((newPitch: number) => {
    setPitchState(Math.max(0, Math.min(2, newPitch)));
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(Math.max(0, Math.min(1, newVolume)));
  }, []);

  const applyPreset = useCallback((preset: VoicePreset) => {
    const settings = VOICE_PRESETS[preset];
    setRateState(settings.rate);
    setPitchState(settings.pitch);
    setVolumeState(settings.volume);
  }, []);

  const findVoiceForLanguage = useCallback(
    (lang: string) => {
      return findBestVoice(voices, lang, options.preferPremium);
    },
    [voices, options.preferPremium]
  );

  return {
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    selectedVoice,
    rate,
    pitch,
    volume,
    speak,
    speakImmediately,
    pause,
    resume,
    togglePause,
    stop,
    clearQueue,
    setVoice,
    setRate,
    setPitch,
    setVolume,
    applyPreset,
    findVoiceForLanguage,
    queueLength,
  };
}

export default useTextToSpeech;
