/**
 * React Hook for Speech Recognition
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  SpeechRecognitionService,
  SpeechRecognitionResult,
  SpeechRecognitionError,
  SpeechRecognitionOptions,
  isSpeechRecognitionSupported,
  getSupportedLanguages,
} from '@/lib/voice/speech-recognition';

export type SpeechRecognitionState =
  | 'inactive'
  | 'starting'
  | 'listening'
  | 'processing'
  | 'error';

export interface UseSpeechRecognitionReturn {
  // State
  state: SpeechRecognitionState;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: SpeechRecognitionError | null;
  isSupported: boolean;
  
  // Actions
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  setLanguage: (lang: string) => void;
  
  // Info
  language: string;
  supportedLanguages: Array<{ code: string; name: string }>;
}

export interface UseSpeechRecognitionOptions extends SpeechRecognitionOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: SpeechRecognitionError) => void;
  onStart?: () => void;
  onEnd?: () => void;
  autoStart?: boolean;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [state, setState] = useState<SpeechRecognitionState>('inactive');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<SpeechRecognitionError | null>(null);
  const [language, setLanguageState] = useState(options.language || 'en-US');
  
  const serviceRef = useRef<SpeechRecognitionService | null>(null);
  const isSupported = isSpeechRecognitionSupported();
  const supportedLanguages = getSupportedLanguages();

  // Initialize service
  useEffect(() => {
    if (!isSupported) return;

    serviceRef.current = new SpeechRecognitionService({
      ...options,
      language,
    });

    const service = serviceRef.current;

    // Bind event handlers
    service.on('start', () => {
      setState('listening');
      setError(null);
      options.onStart?.();
    });

    service.on('end', () => {
      setState('inactive');
      options.onEnd?.();
    });

    service.on('audiostart', () => {
      setState('listening');
    });

    service.onResult((results) => {
      let finalTranscript = '';
      let interim = '';
      let maxConfidence = 0;

      results.forEach((result) => {
        if (result.isFinal) {
          finalTranscript += result.transcript;
          maxConfidence = Math.max(maxConfidence, result.confidence);
        } else {
          interim += result.transcript;
        }
      });

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
        setConfidence(maxConfidence);
        options.onResult?.(finalTranscript, true);
      }

      if (interim) {
        setInterimTranscript(interim);
        options.onResult?.(interim, false);
      }
    });

    service.onError((err) => {
      setError(err);
      setState('error');
      options.onError?.(err);
    });

    // Auto-start if requested
    if (options.autoStart) {
      service.start();
    }

    return () => {
      service.destroy();
    };
  }, [isSupported]);

  // Update language when prop changes
  useEffect(() => {
    if (serviceRef.current && options.language) {
      serviceRef.current.setLanguage(options.language);
      setLanguageState(options.language);
    }
  }, [options.language]);

  const startListening = useCallback(() => {
    if (!serviceRef.current) return;
    
    setState('starting');
    setError(null);
    const started = serviceRef.current.start();
    
    if (!started) {
      setState('error');
      setError({
        error: 'not-allowed',
        message: 'Failed to start speech recognition. Please check permissions.',
      });
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!serviceRef.current) return;
    serviceRef.current.stop();
    setInterimTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    if (state === 'listening' || state === 'starting') {
      stopListening();
    } else {
      startListening();
    }
  }, [state, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    setError(null);
  }, []);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    if (serviceRef.current) {
      serviceRef.current.setLanguage(lang);
    }
  }, []);

  return {
    state,
    transcript,
    interimTranscript,
    confidence,
    error,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setLanguage,
    language,
    supportedLanguages,
  };
}

export default useSpeechRecognition;
