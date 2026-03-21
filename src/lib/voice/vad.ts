/**
 * Voice Activity Detection (VAD) Module
 * Uses Web Audio API to detect speech vs silence with configurable sensitivity
 */

import { getNavigator, isClient } from './browser-support';

// =============================================================================
// Types
// =============================================================================

export type VADEventType = 'voice-start' | 'voice-end' | 'noise' | 'silence' | 'volume';

export interface VADOptions {
  /** Sensitivity threshold (0-1, default: 0.15) - lower = more sensitive */
  threshold?: number;
  /** Hysteresis factor for voice start (default: 1.2) - multiplier for threshold */
  voiceStartHysteresis?: number;
  /** Hysteresis factor for voice end (default: 0.8) - multiplier for threshold */
  voiceEndHysteresis?: number;
  /** Minimum duration of voice activity to trigger voice-start (ms, default: 150) */
  minVoiceDuration?: number;
  /** Minimum duration of silence to trigger voice-end (ms, default: 500) */
  minSilenceDuration?: number;
  /** Audio sample rate for analysis (default: 44100) */
  sampleRate?: number;
  /** FFT size for frequency analysis (default: 2048) */
  fftSize?: number;
  /** Smoothing time constant (0-1, default: 0.8) - higher = smoother */
  smoothingTimeConstant?: number;
  /** Enable frequency-based noise filtering (default: true) */
  enableNoiseFilter?: boolean;
  /** Frequency range for voice detection in Hz (default: { min: 80, max: 4000 }) */
  voiceFrequencyRange?: { min: number; max: number };
}

export interface VADEvent {
  type: VADEventType;
  /** Current volume level (0-1) */
  volume: number;
  /** Timestamp of the event */
  timestamp: number;
  /** Duration of current state in ms */
  duration?: number;
  /** Frequency data for visualization */
  frequencyData?: Uint8Array;
}

export interface VADState {
  /** Whether voice is currently detected */
  isVoiceDetected: boolean;
  /** Whether VAD is currently listening */
  isListening: boolean;
  /** Current volume level (0-1) */
  volume: number;
  /** Duration of current voice activity in ms */
  voiceDuration: number;
  /** Duration of current silence in ms */
  silenceDuration: number;
}

export type VADEventHandler = (event: VADEvent) => void;
export type VADStateChangeHandler = (state: VADState) => void;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_OPTIONS: Required<VADOptions> = {
  threshold: 0.15,
  voiceStartHysteresis: 1.2,
  voiceEndHysteresis: 0.8,
  minVoiceDuration: 150,
  minSilenceDuration: 500,
  sampleRate: 44100,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  enableNoiseFilter: true,
  voiceFrequencyRange: { min: 80, max: 4000 },
};

// =============================================================================
// Voice Activity Detector Class
// =============================================================================

export class VoiceActivityDetector {
  private options: Required<VADOptions>;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  private eventListeners: Map<VADEventType, Set<VADEventHandler>> = new Map();
  private stateChangeListeners: Set<VADStateChangeHandler> = new Set();

  private state: VADState = {
    isVoiceDetected: false,
    isListening: false,
    volume: 0,
    voiceDuration: 0,
    silenceDuration: 0,
  };

  private lastVoiceStartTime = 0;
  private lastVoiceEndTime = 0;
  private animationFrameId: number | null = null;
  private frequencyData: Uint8Array | null = null;

  // Volume history for smoothing
  private volumeHistory: number[] = [];
  private readonly VOLUME_HISTORY_SIZE = 5;

  constructor(options: VADOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Check if VAD is supported in the current browser
   */
  static isSupported(): boolean {
    if (!isClient()) return false;
    return !!(
      getNavigator()?.mediaDevices?.getUserMedia &&
      (window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    );
  }

  /**
   * Start VAD listening
   */
  async start(): Promise<boolean> {
    if (this.state.isListening) {
      return true;
    }

    if (!VoiceActivityDetector.isSupported()) {
      return false;
    }

    try {
      // Get microphone access
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // We want raw audio for VAD
          sampleRate: this.options.sampleRate,
        },
      });

      // Create audio context
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      this.audioContext = new AudioContextClass({
        sampleRate: this.options.sampleRate,
      });

      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.options.fftSize;
      this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      // Create frequency data buffer
      const bufferLength = this.analyser.frequencyBinCount;
      this.frequencyData = new Uint8Array(bufferLength);

      // Connect microphone to analyser
      this.sourceNode = this.audioContext.createMediaStreamSource(this.microphoneStream);
      this.sourceNode.connect(this.analyser);

      // Start processing loop
      this.state.isListening = true;
      this.emitStateChange();
      this.startProcessingLoop();

      return true;
    } catch (_error) {
      this.cleanup();
      return false;
    }
  }

  /**
   * Stop VAD listening
   */
  stop(): void {
    this.state.isListening = false;
    this.state.isVoiceDetected = false;
    this.state.volume = 0;
    this.state.voiceDuration = 0;
    this.state.silenceDuration = 0;
    this.volumeHistory = [];

    this.emitStateChange();
    this.cleanup();
  }

  /**
   * Update options dynamically
   */
  updateOptions(options: Partial<VADOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current state
   */
  getState(): VADState {
    return { ...this.state };
  }

  /**
   * Subscribe to VAD events
   */
  on(event: VADEventType, handler: VADEventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(handler);

    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(handler: VADStateChangeHandler): () => void {
    this.stateChangeListeners.add(handler);
    return () => {
      this.stateChangeListeners.delete(handler);
    };
  }

  /**
   * Subscribe to voice-start event
   */
  onVoiceStart(handler: VADEventHandler): () => void {
    return this.on('voice-start', handler);
  }

  /**
   * Subscribe to voice-end event
   */
  onVoiceEnd(handler: VADEventHandler): () => void {
    return this.on('voice-end', handler);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
    this.stateChangeListeners.clear();
  }

  /**
   * Destroy the VAD instance
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private startProcessingLoop(): void {
    const process = () => {
      if (!this.state.isListening || !this.analyser || !this.frequencyData) {
        return;
      }

      // Get frequency data
      // @ts-expect-error Uint8Array type variant mismatch
      this.analyser.getByteFrequencyData(this.frequencyData);

      // Calculate volume with optional noise filtering
      const volume = this.options.enableNoiseFilter
        ? this.calculateFilteredVolume()
        : this.calculateRawVolume();

      // Smooth volume
      const smoothedVolume = this.smoothVolume(volume);

      // Update state
      this.updateVoiceState(smoothedVolume);
      this.state.volume = smoothedVolume;

      // Emit volume event (clone frequency data to avoid reference issues)
      const freqDataCopy = new Uint8Array(this.frequencyData.length);
      freqDataCopy.set(this.frequencyData);
      this.emit('volume', {
        type: 'volume',
        volume: smoothedVolume,
        timestamp: Date.now(),
        frequencyData: freqDataCopy,
      });

      // Continue loop
      this.animationFrameId = requestAnimationFrame(process);
    };

    process();
  }

  private calculateRawVolume(): number {
    if (!this.frequencyData) return 0;

    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / (this.frequencyData.length * 255);
  }

  private calculateFilteredVolume(): number {
    if (!this.frequencyData || !this.audioContext) return 0;

    const nyquist = this.audioContext.sampleRate / 2;
    const { min, max } = this.options.voiceFrequencyRange;
    const minIndex = Math.floor((min / nyquist) * this.frequencyData.length);
    const maxIndex = Math.ceil((max / nyquist) * this.frequencyData.length);

    let sum = 0;
    let count = 0;

    for (let i = Math.max(0, minIndex); i < Math.min(this.frequencyData.length, maxIndex); i++) {
      sum += this.frequencyData[i];
      count++;
    }

    return count > 0 ? sum / (count * 255) : 0;
  }

  private smoothVolume(volume: number): number {
    this.volumeHistory.push(volume);
    if (this.volumeHistory.length > this.VOLUME_HISTORY_SIZE) {
      this.volumeHistory.shift();
    }

    // Use median filter for better noise rejection
    const sorted = [...this.volumeHistory].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private updateVoiceState(volume: number): void {
    const now = Date.now();
    const voiceStartThreshold = this.options.threshold * this.options.voiceStartHysteresis;
    const voiceEndThreshold = this.options.threshold * this.options.voiceEndHysteresis;

    if (!this.state.isVoiceDetected) {
      // Currently in silence state
      if (volume > voiceStartThreshold) {
        // Potential voice start
        const silenceDuration = now - this.lastVoiceEndTime;
        this.state.silenceDuration = silenceDuration;

        if (silenceDuration >= this.options.minVoiceDuration) {
          // Confirm voice start
          this.state.isVoiceDetected = true;
          this.lastVoiceStartTime = now;
          this.state.voiceDuration = 0;

          const event: VADEvent = {
            type: 'voice-start',
            volume,
            timestamp: now,
            duration: silenceDuration,
            frequencyData: this.frequencyData ? new Uint8Array(this.frequencyData) : undefined,
          };

          this.emit('voice-start', event);
          this.emitStateChange();
        }
      } else {
        // Continued silence
        this.state.silenceDuration = now - this.lastVoiceEndTime;

        // Emit noise event for very low volume activity
        if (volume > this.options.threshold * 0.3) {
          this.emit('noise', {
            type: 'noise',
            volume,
            timestamp: now,
          });
        } else {
          this.emit('silence', {
            type: 'silence',
            volume,
            timestamp: now,
            duration: this.state.silenceDuration,
          });
        }
      }
    } else {
      // Currently in voice state
      if (volume < voiceEndThreshold) {
        // Potential voice end
        const voiceDuration = now - this.lastVoiceStartTime;
        this.state.voiceDuration = voiceDuration;

        if (voiceDuration >= this.options.minSilenceDuration) {
          // Confirm voice end
          this.state.isVoiceDetected = false;
          this.lastVoiceEndTime = now;
          this.state.silenceDuration = 0;

          const event: VADEvent = {
            type: 'voice-end',
            volume,
            timestamp: now,
            duration: voiceDuration,
            frequencyData: this.frequencyData ? new Uint8Array(this.frequencyData) : undefined,
          };

          this.emit('voice-end', event);
          this.emitStateChange();
        }
      } else {
        // Continued voice
        this.state.voiceDuration = now - this.lastVoiceStartTime;
      }
    }
  }

  private emit(event: VADEventType, data: VADEvent): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (_error) {}
      });
    }
  }

  private emitStateChange(): void {
    this.stateChangeListeners.forEach((handler) => {
      try {
        handler({ ...this.state });
      } catch (_error) {}
    });
  }

  private cleanup(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.microphoneStream) {
      for (const track of this.microphoneStream.getTracks()) {
        track.stop();
      }
      this.microphoneStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.frequencyData = null;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a VAD instance with default options
 */
export function createVAD(options?: VADOptions): VoiceActivityDetector {
  return new VoiceActivityDetector(options);
}

/**
 * Quick VAD check - returns a promise that resolves when voice is detected
 */
export async function waitForVoice(
  timeoutMs: number = 10000,
  options?: VADOptions
): Promise<boolean> {
  return new Promise((resolve) => {
    const vad = new VoiceActivityDetector(options);
    const timeout = setTimeout(() => {
      vad.destroy();
      resolve(false);
    }, timeoutMs);

    vad.onVoiceStart(() => {
      clearTimeout(timeout);
      vad.destroy();
      resolve(true);
    });

    void vad.start();
  });
}

/**
 * Detect if audio is currently playing by analyzing a media element
 */
export function detectAudioActivity(
  mediaElement: HTMLMediaElement,
  options?: Partial<VADOptions>
): { isActive: boolean; volume: number; stop: () => void } {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  const audioContext = new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = opts.fftSize;
  analyser.smoothingTimeConstant = opts.smoothingTimeConstant;

  const source = audioContext.createMediaElementSource(mediaElement);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  let isActive = false;
  let volume = 0;
  let animationFrameId: number | null = null;

  const analyze = () => {
    analyser.getByteFrequencyData(frequencyData);

    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    volume = sum / (frequencyData.length * 255);
    isActive = volume > opts.threshold;

    animationFrameId = requestAnimationFrame(analyze);
  };

  analyze();

  return {
    get isActive() {
      return isActive;
    },
    get volume() {
      return volume;
    },
    stop: () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      source.disconnect();
      analyser.disconnect();
      void audioContext.close();
    },
  };
}
