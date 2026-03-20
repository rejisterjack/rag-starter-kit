/**
 * Speech Service for Web Speech API
 * Provides unified interface for Speech-to-Text and Text-to-Speech
 */

import {
  type SpeechRecognitionOptions,
  type SpeechRecognitionError,
  type TTSVoice,
  type TTSSynthesisOptions,
  type VoiceCommand,
  type AudioLevelData,
  type SpeechRecognitionErrorType,
} from './types';
import {
  checkBrowserSupport,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  requestMicrophonePermission,
} from './browser-support';

// =============================================================================
// Type Declarations for Web Speech API
// =============================================================================

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechGrammarList: typeof SpeechGrammarList;
    webkitSpeechGrammarList: typeof SpeechGrammarList;
  }
}

// =============================================================================
// Event Types
// =============================================================================

type SpeechServiceEventType = 
  | 'recognition:start'
  | 'recognition:end'
  | 'recognition:result'
  | 'recognition:error'
  | 'recognition:audiostart'
  | 'recognition:audioend'
  | 'recognition:soundstart'
  | 'recognition:soundend'
  | 'recognition:speechstart'
  | 'recognition:speechend'
  | 'synthesis:start'
  | 'synthesis:end'
  | 'synthesis:error'
  | 'synthesis:pause'
  | 'synthesis:resume'
  | 'synthesis:boundary'
  | 'audiometer:update'
  | 'command:detected';

type SpeechServiceEventHandler = (event: unknown) => void;

// =============================================================================
// SpeechService Class
// =============================================================================

export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private audioLevelInterval: NodeJS.Timeout | null = null;
  
  private eventListeners: Map<SpeechServiceEventType, Set<SpeechServiceEventHandler>> = new Map();
  private commands: Map<string, VoiceCommand> = new Map();
  private transcriptBuffer = '';
  private interimBuffer = '';
  private isListening = false;
  private isSpeaking = false;
  private currentLanguage: SupportedLanguage = 'en-US';
  private options: SpeechRecognitionOptions = {};
  private audioDataArray: Uint8Array | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
      this.initializeSpeechSynthesis();
    }
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private initializeSpeechRecognition(): void {
    if (!isSpeechRecognitionSupported()) {
      console.warn('[SpeechService] SpeechRecognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.setupRecognitionListeners();
  }

  private initializeSpeechSynthesis(): void {
    if (!isSpeechSynthesisSupported()) {
      console.warn('[SpeechService] SpeechSynthesis not supported');
      return;
    }

    this.synthesis = window.speechSynthesis;
  }

  private setupRecognitionListeners(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.emit('recognition:start', null);
      this.startAudioMeter();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.emit('recognition:end', null);
      this.stopAudioMeter();

      // Restart if continuous mode
      if (this.options.continuous && !this.transcriptBuffer.endsWith('\n')) {
        // Small delay before restarting
        setTimeout(() => {
          if (this.options.continuous) {
            this.startListening();
          }
        }, 100);
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleRecognitionResult(event);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.handleRecognitionError(event);
    };

    this.recognition.onaudiostart = () => {
      this.emit('recognition:audiostart', null);
    };

    this.recognition.onaudioend = () => {
      this.emit('recognition:audioend', null);
    };

    this.recognition.onsoundstart = () => {
      this.emit('recognition:soundstart', null);
    };

    this.recognition.onsoundend = () => {
      this.emit('recognition:soundend', null);
    };

    this.recognition.onspeechstart = () => {
      this.emit('recognition:speechstart', null);
    };

    this.recognition.onspeechend = () => {
      this.emit('recognition:speechend', null);
    };
  }

  // ===========================================================================
  // Speech Recognition (STT)
  // ===========================================================================

  /**
   * Configure speech recognition options
   */
  configure(options: SpeechRecognitionOptions): void {
    this.options = { ...this.options, ...options };
    
    if (this.recognition) {
      this.recognition.lang = this.options.language || 'en-US';
      this.recognition.continuous = this.options.continuous ?? false;
      this.recognition.interimResults = this.options.interimResults ?? true;
      this.recognition.maxAlternatives = this.options.maxAlternatives ?? 1;
    }

    if (this.options.language) {
      this.currentLanguage = this.options.language;
    }
  }

  /**
   * Start listening for speech
   */
  async startListening(options?: SpeechRecognitionOptions): Promise<boolean> {
    if (!this.recognition) {
      console.error('[SpeechService] SpeechRecognition not available');
      return false;
    }

    if (this.isListening) {
      console.warn('[SpeechService] Already listening');
      return true;
    }

    // Request microphone permission first
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      this.emit('recognition:error', {
        type: 'not-allowed' as SpeechRecognitionErrorType,
        message: 'Microphone permission denied',
      });
      return false;
    }

    // Apply new options if provided
    if (options) {
      this.configure(options);
    }

    try {
      this.transcriptBuffer = '';
      this.interimBuffer = '';
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('[SpeechService] Failed to start recognition:', error);
      return false;
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (!this.recognition || !this.isListening) return;

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('[SpeechService] Failed to stop recognition:', error);
    }
  }

  /**
   * Abort recognition immediately
   */
  abortListening(): void {
    if (!this.recognition) return;

    try {
      this.recognition.abort();
      this.isListening = false;
      this.stopAudioMeter();
    } catch (error) {
      console.error('[SpeechService] Failed to abort recognition:', error);
    }
  }

  private handleRecognitionResult(event: SpeechRecognitionEvent): void {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;

      if (result.isFinal) {
        finalTranscript += transcript;
        this.transcriptBuffer += transcript + ' ';
        
        // Check for voice commands
        this.checkForCommands(transcript);

        this.emit('recognition:result', {
          transcript: finalTranscript,
          fullTranscript: this.transcriptBuffer.trim(),
          interimTranscript: '',
          isFinal: true,
          confidence,
        });
      } else {
        interimTranscript += transcript;
      }
    }

    this.interimBuffer = interimTranscript;

    // Emit interim results
    if (interimTranscript && this.options.interimResults !== false) {
      this.emit('recognition:result', {
        transcript: '',
        fullTranscript: this.transcriptBuffer.trim(),
        interimTranscript,
        isFinal: false,
        confidence: null,
      });
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEvent): void {
    const error: SpeechRecognitionError = {
      type: event.error as SpeechRecognitionErrorType,
      message: this.getErrorMessage(event.error),
    };

    this.emit('recognition:error', error);

    // Don't treat 'no-speech' as critical error in continuous mode
    if (event.error === 'no-speech' && this.options.continuous) {
      return;
    }

    this.isListening = false;
    this.stopAudioMeter();
  }

  private getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'no-speech': 'No speech was detected. Please try again.',
      'aborted': 'Speech recognition was aborted.',
      'audio-capture': 'No microphone was found or microphone is not working.',
      'network': 'A network error occurred. Please check your connection.',
      'not-allowed': 'Microphone permission was denied.',
      'service-not-allowed': 'Speech recognition service is not allowed.',
      'bad-grammar': 'There was an error with the speech grammar.',
      'language-not-supported': 'The selected language is not supported.',
    };

    return errorMessages[error] || `An unknown error occurred: ${error}`;
  }

  // ===========================================================================
  // Text-to-Speech (TTS)
  // ===========================================================================

  /**
   * Speak text
   */
  speak(text: string, options: TTSSynthesisOptions = {}): boolean {
    if (!this.synthesis) {
      console.error('[SpeechService] SpeechSynthesis not available');
      return false;
    }

    // Cancel any ongoing speech
    this.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Apply options
    utterance.lang = options.lang || this.currentLanguage;
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;

    // Set voice if specified
    if (options.voice) {
      const voices = this.getVoices();
      const voice = voices.find(v => v.voiceURI === options.voice?.voiceURI);
      if (voice) {
        utterance.voice = voice as SpeechSynthesisVoice;
      }
    }

    // Set up event handlers
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.emit('synthesis:start', { text });
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.emit('synthesis:end', { text });
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      this.emit('synthesis:error', { text, error: event.error });
    };

    utterance.onpause = () => {
      this.emit('synthesis:pause', { text });
    };

    utterance.onresume = () => {
      this.emit('synthesis:resume', { text });
    };

    utterance.onboundary = (event) => {
      this.emit('synthesis:boundary', {
        text,
        charIndex: event.charIndex,
        charLength: event.charLength,
        name: event.name,
      });
    };

    this.synthesis.speak(utterance);
    return true;
  }

  /**
   * Cancel ongoing speech
   */
  cancel(): void {
    if (!this.synthesis) return;
    this.synthesis.cancel();
    this.isSpeaking = false;
  }

  /**
   * Pause speech
   */
  pause(): void {
    if (!this.synthesis) return;
    this.synthesis.pause();
  }

  /**
   * Resume speech
   */
  resume(): void {
    if (!this.synthesis) return;
    this.synthesis.resume();
  }

  /**
   * Get available voices
   */
  getVoices(): TTSVoice[] {
    if (!this.synthesis) return [];

    const voices = this.synthesis.getVoices();
    return voices.map(voice => ({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default,
      gender: this.inferVoiceGender(voice.name),
    }));
  }

  /**
   * Get voices for a specific language
   */
  getVoicesForLanguage(lang: string): TTSVoice[] {
    return this.getVoices().filter(voice => 
      voice.lang.toLowerCase().startsWith(lang.toLowerCase())
    );
  }

  private inferVoiceGender(name: string): 'male' | 'female' | 'neutral' {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('female') || lowerName.includes('woman') || lowerName.includes('girl')) {
      return 'female';
    }
    if (lowerName.includes('male') || lowerName.includes('man') || lowerName.includes('boy')) {
      return 'male';
    }
    return 'neutral';
  }

  // ===========================================================================
  // Audio Meter
  // ===========================================================================

  private async startAudioMeter(): Promise<void> {
    if (!navigator.mediaDevices) return;

    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      const source = this.audioContext.createMediaStreamSource(this.microphoneStream);
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.audioDataArray = new Uint8Array(bufferLength);

      this.audioLevelInterval = setInterval(() => {
        this.updateAudioLevel();
      }, 50);
    } catch (error) {
      console.error('[SpeechService] Failed to start audio meter:', error);
    }
  }

  private stopAudioMeter(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
      this.microphoneStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.audioDataArray = null;
  }

  private updateAudioLevel(): void {
    if (!this.analyser || !this.audioDataArray) return;

    this.analyser.getByteFrequencyData(this.audioDataArray);

    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < this.audioDataArray.length; i++) {
      sum += this.audioDataArray[i];
    }
    const average = sum / this.audioDataArray.length;
    const level = average / 255; // Normalize to 0-1

    const audioData: AudioLevelData = {
      level,
      frequencyData: this.audioDataArray,
      isSpeaking: level > 0.1,
    };

    this.emit('audiometer:update', audioData);
  }

  // ===========================================================================
  // Voice Commands
  // ===========================================================================

  /**
   * Register a voice command
   */
  registerCommand(command: VoiceCommand): void {
    this.commands.set(command.id, command);
  }

  /**
   * Unregister a voice command
   */
  unregisterCommand(id: string): void {
    this.commands.delete(id);
  }

  /**
   * Clear all commands
   */
  clearCommands(): void {
    this.commands.clear();
  }

  private checkForCommands(transcript: string): void {
    const lowerTranscript = transcript.toLowerCase().trim();

    for (const command of this.commands.values()) {
      for (const phrase of command.phrases) {
        if (lowerTranscript.includes(phrase.toLowerCase())) {
          this.emit('command:detected', {
            commandId: command.id,
            phrase,
            transcript,
          });
          
          // Extract arguments (text after the command phrase)
          const phraseIndex = lowerTranscript.indexOf(phrase.toLowerCase());
          const args = transcript.slice(phraseIndex + phrase.length).trim();
          
          command.handler(args);
          return; // Only execute first matching command
        }
      }
    }
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to events
   */
  on(event: SpeechServiceEventType, handler: SpeechServiceEventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to event once
   */
  once(event: SpeechServiceEventType, handler: SpeechServiceEventHandler): void {
    const onceHandler = (data: unknown) => {
      handler(data);
      this.eventListeners.get(event)?.delete(onceHandler);
    };
    this.on(event, onceHandler);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: SpeechServiceEventType): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  private emit(event: SpeechServiceEventType, data: unknown): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[SpeechService] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  get isListeningState(): boolean {
    return this.isListening;
  }

  get isSpeakingState(): boolean {
    return this.isSpeaking;
  }

  get transcript(): string {
    return this.transcriptBuffer.trim();
  }

  get interimTranscript(): string {
    return this.interimBuffer;
  }

  get fullTranscript(): string {
    return (this.transcriptBuffer + this.interimBuffer).trim();
  }

  get language(): SupportedLanguage {
    return this.currentLanguage;
  }

  // ===========================================================================
  // Static Methods
  // ===========================================================================

  static isSupported(): boolean {
    return isSpeechRecognitionSupported() || isSpeechSynthesisSupported();
  }

  static checkSupport() {
    return checkBrowserSupport();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let speechServiceInstance: SpeechService | null = null;

export function getSpeechService(): SpeechService {
  if (!speechServiceInstance) {
    speechServiceInstance = new SpeechService();
  }
  return speechServiceInstance;
}

export function resetSpeechService(): void {
  if (speechServiceInstance) {
    speechServiceInstance.abortListening();
    speechServiceInstance.cancel();
    speechServiceInstance.removeAllListeners();
  }
  speechServiceInstance = null;
}
