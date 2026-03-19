/**
 * Text-to-Speech Service
 * Web Speech API synthesis wrapper
 */

export interface TextToSpeechOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export interface TTSQueueItem {
  id: string;
  text: string;
  options: TextToSpeechOptions;
  resolve: () => void;
  reject: (error: Error) => void;
}

export type TTSEventType = 'start' | 'end' | 'pause' | 'resume' | 'error' | 'boundary' | 'mark';

type TTSEventHandler = (event: SpeechSynthesisEvent) => void;

export class TextToSpeechService {
  private synthesis: SpeechSynthesis | null = null;
  private queue: TTSQueueItem[] = [];
  private currentItem: TTSQueueItem | null = null;
  private isProcessing = false;
  private isPaused = false;
  private eventHandlers: Map<TTSEventType, Set<TTSEventHandler>> = new Map();
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    this.synthesis = window.speechSynthesis;

    if (!this.synthesis) {
      console.warn('Text-to-Speech API not supported in this browser');
      return;
    }

    this.loadVoices();

    // Voices may load asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    if (!this.synthesis) return;

    this.voices = this.synthesis.getVoices();
    this.voicesLoaded = true;
  }

  private emit(eventType: TTSEventType, event: SpeechSynthesisEvent) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.currentItem = this.queue.shift() || null;

    if (!this.currentItem) {
      this.isProcessing = false;
      return;
    }

    const { text, options, resolve, reject } = this.currentItem;

    try {
      await this.speakInternal(text, options);
      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error('TTS failed'));
    } finally {
      this.currentItem = null;
      this.isProcessing = false;
      this.processQueue();
    }
  }

  private speakInternal(text: string, options: TextToSpeechOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Text-to-Speech not initialized'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // Apply options
      if (options.voice) utterance.voice = options.voice;
      if (options.rate !== undefined) utterance.rate = options.rate;
      if (options.pitch !== undefined) utterance.pitch = options.pitch;
      if (options.volume !== undefined) utterance.volume = options.volume;
      if (options.lang) utterance.lang = options.lang;

      // Bind events
      utterance.onstart = (e) => {
        this.emit('start', e);
      };

      utterance.onend = (e) => {
        this.emit('end', e);
        resolve();
      };

      utterance.onerror = (e) => {
        this.emit('error', e);
        reject(new Error(`Speech synthesis error: ${e.error}`));
      };

      utterance.onpause = (e) => this.emit('pause', e);
      utterance.onresume = (e) => this.emit('resume', e);
      utterance.onboundary = (e) => this.emit('boundary', e);
      utterance.onmark = (e) => this.emit('mark', e);

      this.synthesis.speak(utterance);
    });
  }

  // Public API
  speak(text: string, options: TextToSpeechOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const item: TTSQueueItem = {
        id: crypto.randomUUID(),
        text,
        options,
        resolve,
        reject,
      };

      this.queue.push(item);
      this.processQueue();
    });
  }

  speakImmediately(text: string, options: TextToSpeechOptions = {}): Promise<void> {
    this.clearQueue();
    return this.speak(text, options);
  }

  pause(): void {
    if (!this.synthesis) return;
    this.synthesis.pause();
    this.isPaused = true;
  }

  resume(): void {
    if (!this.synthesis) return;
    this.synthesis.resume();
    this.isPaused = false;
    this.processQueue();
  }

  cancel(): void {
    if (!this.synthesis) return;
    this.synthesis.cancel();
    this.queue = [];
    this.currentItem = null;
    this.isProcessing = false;
    this.isPaused = false;
  }

  clearQueue(): void {
    this.queue = [];
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  getVoicesByLang(lang: string): SpeechSynthesisVoice[] {
    return this.voices.filter((v) => v.lang.startsWith(lang));
  }

  getDefaultVoice(): SpeechSynthesisVoice | null {
    return this.voices.find((v) => v.default) || this.voices[0] || null;
  }

  getPremiumVoices(): SpeechSynthesisVoice[] {
    // Filter for premium/local voices (typically higher quality)
    return this.voices.filter((v) => 
      v.localService || 
      v.name.includes('Premium') ||
      v.name.includes('Enhanced') ||
      v.name.includes('Neural')
    );
  }

  areVoicesLoaded(): boolean {
    return this.voicesLoaded;
  }

  waitForVoices(): Promise<void> {
    return new Promise((resolve) => {
      if (this.voicesLoaded) {
        resolve();
        return;
      }

      const checkVoices = setInterval(() => {
        if (this.voicesLoaded) {
          clearInterval(checkVoices);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkVoices);
        resolve();
      }, 5000);
    });
  }

  isSpeaking(): boolean {
    return this.isProcessing && !this.isPaused;
  }

  isPaused(): boolean {
    return this.isPaused;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  on(event: TTSEventType, handler: TTSEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  destroy(): void {
    this.cancel();
    this.eventHandlers.clear();
    this.synthesis = null;
  }
}

// Singleton instance
let globalTTS: TextToSpeechService | null = null;

export function getTextToSpeech(): TextToSpeechService {
  if (!globalTTS) {
    globalTTS = new TextToSpeechService();
  }
  return globalTTS;
}

export function isTextToSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Helper to find best voice for language
export function findBestVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  preferPremium = true
): SpeechSynthesisVoice | null {
  const langVoices = voices.filter((v) => v.lang.startsWith(lang));

  if (langVoices.length === 0) return null;

  if (preferPremium) {
    const premium = langVoices.find(
      (v) => v.localService || v.name.includes('Premium') || v.name.includes('Neural')
    );
    if (premium) return premium;
  }

  // Prefer default voice
  const defaultVoice = langVoices.find((v) => v.default);
  if (defaultVoice) return defaultVoice;

  return langVoices[0];
}

// Predefined voice presets
export const VOICE_PRESETS = {
  natural: { rate: 1, pitch: 1, volume: 1 },
  fast: { rate: 1.3, pitch: 1, volume: 1 },
  slow: { rate: 0.8, pitch: 1, volume: 1 },
  professional: { rate: 0.95, pitch: 0.95, volume: 1 },
  friendly: { rate: 1.05, pitch: 1.05, volume: 1 },
} as const;

export type VoicePreset = keyof typeof VOICE_PRESETS;
