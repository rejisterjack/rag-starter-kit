/**
 * Speech Recognition Service
 * Web Speech API wrapper with cross-browser support
 */

import type {
  SpeechRecognitionErrorType,
  SpeechRecognitionInstance,
  SpeechRecognitionResult,
} from '@/types';

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export type SpeechRecognitionEventType =
  | 'start'
  | 'end'
  | 'result'
  | 'error'
  | 'nomatch'
  | 'audiostart'
  | 'audioend'
  | 'soundstart'
  | 'soundend'
  | 'speechstart'
  | 'speechend';

export interface SpeechRecognitionError {
  error: SpeechRecognitionErrorType;
  message: string;
}

type EventHandler = (event: Event) => void;
type ResultHandler = (results: SpeechRecognitionResult[]) => void;
type ErrorHandler = (error: SpeechRecognitionError) => void;

export class SpeechRecognitionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private eventHandlers: Map<SpeechRecognitionEventType, Set<EventHandler>> = new Map();
  private resultHandlers: Set<ResultHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  constructor(private options: SpeechRecognitionOptions = {}) {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('Speech Recognition API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.configure();
    this.bindEvents();
  }

  private configure() {
    if (!this.recognition) return;

    this.recognition.lang = this.options.language || 'en-US';
    this.recognition.continuous = this.options.continuous ?? true;
    this.recognition.interimResults = this.options.interimResults ?? true;
    this.recognition.maxAlternatives = this.options.maxAlternatives ?? 1;
  }

  private bindEvents() {
    if (!this.recognition) return;

    this.recognition.onstart = () => this.emit('start');
    this.recognition.onend = () => {
      this.isListening = false;
      this.emit('end');
    };
    this.recognition.onaudiostart = () => this.emit('audiostart');
    this.recognition.onaudioend = () => this.emit('audioend');
    this.recognition.onsoundstart = () => this.emit('soundstart');
    this.recognition.onsoundend = () => this.emit('soundend');
    this.recognition.onspeechstart = () => this.emit('speechstart');
    this.recognition.onspeechend = () => this.emit('speechend');
    this.recognition.onnomatch = () => this.emit('nomatch');

    this.recognition.onresult = (event) => {
      const results: SpeechRecognitionResult[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result[0];
        results.push({
          transcript: alternative.transcript,
          confidence: alternative.confidence,
          isFinal: result.isFinal,
          alternatives: [
            {
              transcript: alternative.transcript,
              confidence: alternative.confidence,
            },
          ],
          [0]: {
            transcript: alternative.transcript,
            confidence: alternative.confidence,
          },
        });
      }

      this.resultHandlers.forEach((handler) => handler(results));
    };

    this.recognition.onerror = (event) => {
      const error: SpeechRecognitionError = {
        error: event.error as SpeechRecognitionErrorType,
        message: this.getErrorMessage(event.error as SpeechRecognitionErrorType),
      };
      this.errorHandlers.forEach((handler) => handler(error));
    };
  }

  private emit(eventType: SpeechRecognitionEventType, event?: Event) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(event || new Event(eventType)));
    }
  }

  private getErrorMessage(error: SpeechRecognitionErrorType): string {
    const messages: Record<SpeechRecognitionErrorType, string> = {
      'no-speech': 'No speech was detected. Please try speaking.',
      aborted: 'Speech recognition was aborted.',
      'audio-capture': 'No microphone was found or microphone is not working.',
      network: 'A network error occurred. Please check your connection.',
      'not-allowed': 'Microphone permission was denied. Please allow access.',
      'service-not-allowed': 'Speech recognition service is not allowed.',
      'bad-grammar': 'There was an error with the speech grammar.',
      'language-not-supported': 'The selected language is not supported.',
      unknown: 'An unknown error occurred.',
    };
    return messages[error] || 'An unknown error occurred.';
  }

  // Public API
  start(): boolean {
    if (!this.recognition) {
      console.error('Speech Recognition not initialized');
      return false;
    }

    if (this.isListening) {
      console.warn('Speech Recognition is already listening');
      return false;
    }

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      return false;
    }
  }

  stop(): void {
    if (!this.recognition || !this.isListening) return;

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }

  abort(): void {
    if (!this.recognition) return;

    try {
      this.recognition.abort();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to abort speech recognition:', error);
    }
  }

  on(event: SpeechRecognitionEventType, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  onResult(handler: ResultHandler): () => void {
    this.resultHandlers.add(handler);
    return () => this.resultHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  setLanguage(language: string): void {
    this.options.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  getLanguage(): string {
    return this.options.language || 'en-US';
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }

  getListeningState(): boolean {
    return this.isListening;
  }

  destroy(): void {
    this.abort();
    this.eventHandlers.clear();
    this.resultHandlers.clear();
    this.errorHandlers.clear();
    this.recognition = null;
  }
}

// Singleton instance
let globalInstance: SpeechRecognitionService | null = null;

export function getSpeechRecognition(options?: SpeechRecognitionOptions): SpeechRecognitionService {
  if (!globalInstance) {
    globalInstance = new SpeechRecognitionService(options);
  }
  return globalInstance;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Helper to get supported languages
export function getSupportedLanguages(): Array<{ code: string; name: string }> {
  return [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'ru-RU', name: 'Russian' },
    { code: 'ar-SA', name: 'Arabic' },
    { code: 'hi-IN', name: 'Hindi' },
  ];
}
