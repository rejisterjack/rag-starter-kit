/**
 * Wake Word Detection Module
 * Uses Web Speech API with custom grammar for wake word detection
 * Supports low-power listening mode
 */

import { getNavigator, isClient, isSpeechRecognitionSupported } from './browser-support';
import type { 
  SupportedLanguage,
  SpeechRecognitionInstance,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent 
} from '@/types';

// =============================================================================
// Types
// =============================================================================

export type WakeWordEventType = 'wake' | 'error' | 'start' | 'stop' | 'listening';

export interface WakeWordOptions {
  /** List of wake words to detect (default: ['Hey RAG', 'OK Assistant']) */
  wakeWords?: string[];
  /** Language for recognition (default: 'en-US') */
  language?: SupportedLanguage;
  /** Whether to use low-power listening mode (default: true) */
  lowPowerMode?: boolean;
  /** Confidence threshold for wake word detection (0-1, default: 0.7) */
  confidenceThreshold?: number;
  /** Timeout for continuous listening in ms (default: 0 = no timeout) */
  timeout?: number;
  /** Whether to stop after detecting a wake word (default: false) */
  stopAfterWake?: boolean;
  /** Enable continuous listening for multiple wake words (default: true) */
  continuous?: boolean;
  /** Partial results for faster detection (default: true) */
  interimResults?: boolean;
  /** Maximum alternatives to consider (default: 3) */
  maxAlternatives?: number;
}

export interface WakeWordEvent {
  type: WakeWordEventType;
  /** Detected wake word */
  wakeWord?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Full transcript that contained the wake word */
  transcript?: string;
  /** Timestamp of the event */
  timestamp: number;
  /** Error message if type is 'error' */
  error?: string;
  /** Whether currently in low-power mode */
  isLowPower?: boolean;
}

export interface WakeWordState {
  /** Whether wake word detection is active */
  isListening: boolean;
  /** Whether currently in low-power mode */
  isLowPowerMode: boolean;
  /** Number of wake words detected */
  wakeCount: number;
  /** Last detected wake word */
  lastWakeWord: string | null;
  /** Time of last wake word detection */
  lastWakeTime: number | null;
}

export type WakeWordEventHandler = (event: WakeWordEvent) => void;
export type WakeWordStateChangeHandler = (state: WakeWordState) => void;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_WAKE_WORDS = ['Hey RAG', 'OK Assistant'];

const DEFAULT_OPTIONS: Required<Omit<WakeWordOptions, 'language'>> & { language: SupportedLanguage } = {
  wakeWords: DEFAULT_WAKE_WORDS,
  language: 'en-US',
  lowPowerMode: true,
  confidenceThreshold: 0.7,
  timeout: 0,
  stopAfterWake: false,
  continuous: true,
  interimResults: true,
  maxAlternatives: 3,
};

// Grammar hints for better recognition accuracy
const WAKE_WORD_GRAMMAR_HINTS = [
  'hey rag',
  'ok assistant',
  'okay assistant',
  'hey assistant',
  'wake up',
  'listen',
];

// =============================================================================
// Wake Word Detector Class
// =============================================================================

export class WakeWordDetector {
  private options: Required<Omit<WakeWordOptions, 'language'>> & { language: SupportedLanguage };
  private recognition: SpeechRecognitionInstance | null = null;
  private eventListeners: Map<WakeWordEventType, Set<WakeWordEventHandler>> = new Map();
  private stateChangeListeners: Set<WakeWordStateChangeHandler> = new Set();
  
  private state: WakeWordState = {
    isListening: false,
    isLowPowerMode: false,
    wakeCount: 0,
    lastWakeWord: null,
    lastWakeTime: null,
  };

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  constructor(options: WakeWordOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      wakeWords: options.wakeWords?.length ? options.wakeWords : DEFAULT_WAKE_WORDS,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Check if wake word detection is supported
   */
  static isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  /**
   * Check if low-power mode is supported
   */
  static isLowPowerModeSupported(): boolean {
    if (!isClient()) return false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;
    
    // Check for properties that indicate low-power support
    const recognition = new SpeechRecognition();
    return 'audioStartThreshold' in recognition || 'speechStartThreshold' in recognition;
  }

  /**
   * Start wake word detection
   */
  async start(): Promise<boolean> {
    if (this.state.isListening) {
      return true;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      this.emitError('Speech recognition not supported in this browser');
      return false;
    }

    try {
      // Request microphone permission first
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        this.emitError('Microphone permission denied');
        return false;
      }

      this.initializeRecognition();
      
      if (!this.recognition) {
        this.emitError('Failed to initialize speech recognition');
        return false;
      }

      this.state.isListening = true;
      this.state.isLowPowerMode = this.options.lowPowerMode;
      this.emitStateChange();
      this.emit('start', { type: 'start', timestamp: Date.now(), isLowPower: this.state.isLowPowerMode });

      this.recognition.start();

      // Set timeout if specified
      if (this.options.timeout > 0) {
        this.timeoutId = setTimeout(() => {
          this.stop();
        }, this.options.timeout);
      }

      return true;
    } catch (error) {
      this.emitError(`Failed to start wake word detection: ${error instanceof Error ? error.message : String(error)}`);
      this.cleanup();
      return false;
    }
  }

  /**
   * Stop wake word detection
   */
  stop(): void {
    if (!this.state.isListening) {
      return;
    }

    this.cleanup();
    
    this.state.isListening = false;
    this.state.isLowPowerMode = false;
    this.emitStateChange();
    this.emit('stop', { type: 'stop', timestamp: Date.now() });
  }

  /**
   * Pause detection temporarily (keeps microphone access)
   */
  pause(): void {
    if (this.recognition && this.state.isListening) {
      try {
        this.recognition.stop();
        this.state.isListening = false;
        this.emitStateChange();
      } catch {
        // Ignore errors when stopping
      }
    }
  }

  /**
   * Resume detection after pause
   */
  resume(): void {
    if (!this.state.isListening && this.recognition) {
      try {
        this.recognition.start();
        this.state.isListening = true;
        this.emitStateChange();
        this.emit('start', { type: 'start', timestamp: Date.now(), isLowPower: this.state.isLowPowerMode });
      } catch (error) {
        this.emitError(`Failed to resume: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Update options dynamically
   */
  updateOptions(options: Partial<WakeWordOptions>): void {
    const wasListening = this.state.isListening;
    
    if (wasListening) {
      this.stop();
    }

    this.options = {
      ...this.options,
      ...options,
      wakeWords: options.wakeWords?.length ? options.wakeWords : this.options.wakeWords,
    };

    if (wasListening) {
      void this.start();
    }
  }

  /**
   * Update wake words
   */
  setWakeWords(wakeWords: string[]): void {
    this.updateOptions({ wakeWords: wakeWords.length ? wakeWords : DEFAULT_WAKE_WORDS });
  }

  /**
   * Add a wake word
   */
  addWakeWord(wakeWord: string): void {
    if (!this.options.wakeWords.includes(wakeWord)) {
      this.updateOptions({
        wakeWords: [...this.options.wakeWords, wakeWord],
      });
    }
  }

  /**
   * Remove a wake word
   */
  removeWakeWord(wakeWord: string): void {
    this.updateOptions({
      wakeWords: this.options.wakeWords.filter((w) => w.toLowerCase() !== wakeWord.toLowerCase()),
    });
  }

  /**
   * Get current wake words
   */
  getWakeWords(): string[] {
    return [...this.options.wakeWords];
  }

  /**
   * Get current state
   */
  getState(): WakeWordState {
    return { ...this.state };
  }

  /**
   * Subscribe to wake word events
   */
  on(event: WakeWordEventType, handler: WakeWordEventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(handler: WakeWordStateChangeHandler): () => void {
    this.stateChangeListeners.add(handler);
    return () => {
      this.stateChangeListeners.delete(handler);
    };
  }

  /**
   * Subscribe to wake word detection
   */
  onWake(handler: (event: WakeWordEvent) => void): () => void {
    return this.on('wake', handler);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
    this.stateChangeListeners.clear();
  }

  /**
   * Destroy the detector
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async requestMicrophonePermission(): Promise<boolean> {
    if (!getNavigator()?.mediaDevices) {
      return false;
    }

    try {
      this.abortController = new AbortController();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      // Stop tracks immediately, we just need permission
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error('[WakeWord] Microphone permission denied:', error);
      return false;
    }
  }

  private initializeRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    this.recognition = new SpeechRecognition() as SpeechRecognitionInstance;
    this.recognition.continuous = this.options.continuous;
    this.recognition.interimResults = this.options.interimResults;
    this.recognition.maxAlternatives = this.options.maxAlternatives;
    this.recognition.lang = this.options.language;

    // Set up grammar list if available
    this.setupGrammar();

    // Set up event handlers
    this.recognition.onstart = () => {
      this.state.isListening = true;
      this.emitStateChange();
      this.emit('listening', { type: 'listening', timestamp: Date.now(), isLowPower: this.state.isLowPowerMode });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleRecognitionResult(event as unknown as globalThis.SpeechRecognitionEvent);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorEvent = event as unknown as { error: string };
      // Don't treat 'no-speech' as error in continuous mode
      if (errorEvent.error === 'no-speech' && this.options.continuous) {
        return;
      }

      // Handle 'aborted' error when stopping
      if (errorEvent.error === 'aborted' && !this.state.isListening) {
        return;
      }

      this.emitError(`Recognition error: ${errorEvent.error}`);
    };

    this.recognition.onend = () => {
      // Restart if still listening and in continuous mode
      if (this.state.isListening && this.options.continuous && !this.options.stopAfterWake) {
        setTimeout(() => {
          if (this.state.isListening && this.recognition) {
            try {
              this.recognition.start();
            } catch {
              // Ignore restart errors
            }
          }
        }, 100);
      } else if (!this.options.continuous) {
        this.state.isListening = false;
        this.emitStateChange();
      }
    };
  }

  private setupGrammar(): void {
    if (!this.recognition) return;

    const GrammarList = (window as unknown as { 
      SpeechGrammarList?: new () => { addFromString: (grammar: string, weight: number) => void };
      webkitSpeechGrammarList?: new () => { addFromString: (grammar: string, weight: number) => void };
    }).SpeechGrammarList || (window as unknown as { 
      webkitSpeechGrammarList?: new () => { addFromString: (grammar: string, weight: number) => void };
    }).webkitSpeechGrammarList;
    if (!GrammarList) return;

    try {
      const grammar = new GrammarList();
      
      // Add wake words to grammar with weights
      const wakeWordsLower = this.options.wakeWords.map(w => w.toLowerCase());
      const allPhrases = [...new Set([...wakeWordsLower, ...WAKE_WORD_GRAMMAR_HINTS])];
      
      // Create weighted grammar string - use simple grammar format
      const grammarString = `#JSGF V1.0; grammar wake; public <wake> = ${allPhrases.join(' | ')};`;
      
      grammar.addFromString(grammarString, 1.0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.recognition as unknown as { grammars: unknown }).grammars = grammar;
    } catch (error) {
      console.warn('[WakeWord] Failed to set grammar:', error);
    }
  }

  private handleRecognitionResult(event: globalThis.SpeechRecognitionEvent): void {
    const results = event.results;
    if (!results || results.length === 0) return;

    const now = Date.now();

    // Process results from most recent to oldest for faster detection
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i];
      if (!result) continue;

      // Check all alternatives
      for (let j = 0; j < (result as unknown as { length: number }).length; j++) {
        const alternative = result[j];
        if (!alternative) continue;

        const transcript = (alternative.transcript ?? '').toLowerCase().trim();
        const confidence = alternative.confidence ?? 0;

        // Check if any wake word is in the transcript
        for (const wakeWord of this.options.wakeWords) {
          const wakeWordLower = wakeWord.toLowerCase();
          
          // Direct match or fuzzy match
          if (this.matchesWakeWord(transcript, wakeWordLower, confidence)) {
            this.handleWakeWordDetected(wakeWord, confidence, alternative.transcript || '', now);
            return;
          }
        }
      }
    }
  }

  private matchesWakeWord(transcript: string, wakeWord: string, confidence: number): boolean {
    // Exact match
    if (transcript.includes(wakeWord)) {
      return confidence >= this.options.confidenceThreshold;
    }

    // Fuzzy matching for common variations
    const normalizedTranscript = transcript.replace(/[.,!?;:'"-]/g, '');
    const normalizedWakeWord = wakeWord.replace(/[.,!?;:'"-]/g, '');

    if (normalizedTranscript.includes(normalizedWakeWord)) {
      return confidence >= this.options.confidenceThreshold;
    }

    // Word-by-word matching for partial matches
    const wakeWords = normalizedWakeWord.split(/\s+/);
    const transcriptWords = normalizedTranscript.split(/\s+/);
    
    // Check if all wake word parts are in transcript
    const allPartsFound = wakeWords.every(word => 
      transcriptWords.some(tw => tw.includes(word) || word.includes(tw))
    );

    if (allPartsFound) {
      // Require higher confidence for fuzzy matches
      return confidence >= this.options.confidenceThreshold * 1.1;
    }

    return false;
  }

  private handleWakeWordDetected(
    wakeWord: string,
    confidence: number,
    transcript: string,
    timestamp: number
  ): void {
    this.state.wakeCount++;
    this.state.lastWakeWord = wakeWord;
    this.state.lastWakeTime = timestamp;

    const event: WakeWordEvent = {
      type: 'wake',
      wakeWord,
      confidence,
      transcript,
      timestamp,
      isLowPower: this.state.isLowPowerMode,
    };

    this.emit('wake', event);
    this.emitStateChange();

    // Stop after wake if configured
    if (this.options.stopAfterWake) {
      this.stop();
    }
  }

  private emitError(message: string): void {
    this.emit('error', {
      type: 'error',
      error: message,
      timestamp: Date.now(),
    });
  }

  private emit(event: WakeWordEventType, data: WakeWordEvent): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WakeWord] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private emitStateChange(): void {
    this.stateChangeListeners.forEach((handler) => {
      try {
        handler({ ...this.state });
      } catch (error) {
        console.error('[WakeWord] Error in state change handler:', error);
      }
    });
  }

  private cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore errors when stopping
      }
      this.recognition = null;
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a wake word detector with default options
 */
export function createWakeWordDetector(options?: WakeWordOptions): WakeWordDetector {
  return new WakeWordDetector(options);
}

/**
 * Quick wake word detection - listens for a single wake word
 */
export async function waitForWakeWord(
  wakeWords?: string[],
  timeoutMs: number = 30000
): Promise<{ wakeWord: string; confidence: number } | null> {
  return new Promise((resolve) => {
    const detector = new WakeWordDetector({
      wakeWords,
      continuous: false,
      stopAfterWake: true,
    });

    const timeout = setTimeout(() => {
      detector.destroy();
      resolve(null);
    }, timeoutMs);

    detector.onWake((event) => {
      clearTimeout(timeout);
      detector.destroy();
      resolve({
        wakeWord: event.wakeWord || '',
        confidence: event.confidence || 0,
      });
    });

    detector.on('error', () => {
      clearTimeout(timeout);
      detector.destroy();
      resolve(null);
    });

    void detector.start();
  });
}

/**
 * Check if browser supports wake word detection with required features
 */
export function checkWakeWordSupport(): {
  supported: boolean;
  lowPowerMode: boolean;
  grammarSupport: boolean;
} {
  if (!isClient()) {
    return { supported: false, lowPowerMode: false, grammarSupport: false };
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasRecognition = !!SpeechRecognition;
  
  let grammarSupport = false;
  if (hasRecognition) {
    const GrammarList = (window as unknown as { 
      SpeechGrammarList?: unknown;
      webkitSpeechGrammarList?: unknown;
    }).SpeechGrammarList || (window as unknown as { 
      webkitSpeechGrammarList?: unknown;
    }).webkitSpeechGrammarList;
    grammarSupport = !!GrammarList;
  }

  return {
    supported: hasRecognition,
    lowPowerMode: WakeWordDetector.isLowPowerModeSupported(),
    grammarSupport,
  };
}

/**
 * Predefined wake word sets for common use cases
 */
export const WAKE_WORD_SETS = {
  /** Default wake words */
  default: ['Hey RAG', 'OK Assistant'],
  /** Smart assistant style wake words */
  assistant: ['Hey Assistant', 'OK Assistant', 'Hey AI'],
  /** Computer style wake words */
  computer: ['Hey Computer', 'OK Computer', 'Computer'],
  /** Customizable - allows user to set their own */
  custom: [] as string[],
} as const;

/**
 * Set default wake words based on use case
 */
export function getDefaultWakeWords(set: keyof typeof WAKE_WORD_SETS = 'default'): string[] {
  return [...WAKE_WORD_SETS[set]];
}
