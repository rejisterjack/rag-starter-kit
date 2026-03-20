/**
 * Voice-related TypeScript types and interfaces
 * Provides type definitions for Speech-to-Text and Text-to-Speech features
 */

// =============================================================================
// Speech Recognition Types
// =============================================================================

/**
 * Supported languages for speech recognition and synthesis
 */
export type SupportedLanguage =
  | 'en-US'
  | 'en-GB'
  | 'en-AU'
  | 'en-CA'
  | 'en-IN'
  | 'es-ES'
  | 'es-MX'
  | 'es-AR'
  | 'fr-FR'
  | 'fr-CA'
  | 'de-DE'
  | 'de-AT'
  | 'de-CH'
  | 'it-IT'
  | 'pt-BR'
  | 'pt-PT'
  | 'nl-NL'
  | 'pl-PL'
  | 'ru-RU'
  | 'ja-JP'
  | 'ko-KR'
  | 'zh-CN'
  | 'zh-TW'
  | 'zh-HK'
  | 'ar-SA'
  | 'ar-AE'
  | 'ar-EG'
  | 'hi-IN'
  | 'th-TH'
  | 'vi-VN'
  | 'tr-TR'
  | 'id-ID'
  | 'auto';

/**
 * Language display information
 */
export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag?: string;
}

/**
 * Speech recognition configuration options
 */
export interface SpeechRecognitionOptions {
  /** Language code (e.g., 'en-US') */
  language?: SupportedLanguage;
  /** Enable continuous listening */
  continuous?: boolean;
  /** Return interim results */
  interimResults?: boolean;
  /** Maximum alternatives per result */
  maxAlternatives?: number;
  /** Enable automatic language detection */
  autoDetectLanguage?: boolean;
}

/**
 * Speech recognition result alternative
 */
export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

/**
 * Speech recognition result
 */
export interface SpeechRecognitionResult {
  isFinal: boolean;
  alternatives: SpeechRecognitionAlternative[];
  transcript: string;
  confidence: number;
}

/**
 * Speech recognition error types
 */
export type SpeechRecognitionErrorType =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'unknown';

/**
 * Speech recognition error
 */
export interface SpeechRecognitionError {
  type: SpeechRecognitionErrorType;
  message: string;
}

// =============================================================================
// Text-to-Speech Types
// =============================================================================

/**
 * Voice information for speech synthesis
 */
export interface TTSVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * Text-to-speech configuration options
 */
export interface TTSSynthesisOptions {
  /** Voice to use for synthesis */
  voice?: TTSVoice;
  /** Speech rate (0.1 to 10, default 1) */
  rate?: number;
  /** Speech pitch (0 to 2, default 1) */
  pitch?: number;
  /** Speech volume (0 to 1, default 1) */
  volume?: number;
  /** Language code */
  lang?: SupportedLanguage;
}

/**
 * TTS event types
 */
export type TTSEventType = 'start' | 'end' | 'error' | 'pause' | 'resume' | 'boundary' | 'mark';

/**
 * TTS event callback
 */
export type TTSEventCallback = (event: {
  type: TTSEventType;
  charIndex?: number;
  charLength?: number;
}) => void;

// =============================================================================
// Voice Command Types
// =============================================================================

/**
 * Voice command handler function
 */
export type VoiceCommandHandler = (args?: string) => void;

/**
 * Voice command definition
 */
export interface VoiceCommand {
  /** Command identifier */
  id: string;
  /** Phrases that trigger this command */
  phrases: string[];
  /** Handler function */
  handler: VoiceCommandHandler;
  /** Whether command requires confirmation */
  requiresConfirmation?: boolean;
  /** Description for help/feedback */
  description: string;
}

/**
 * Built-in voice commands
 */
export type BuiltInVoiceCommand =
  | 'new-chat'
  | 'send-message'
  | 'clear-chat'
  | 'stop-speaking'
  | 'help'
  | 'settings';

// =============================================================================
// Voice Settings Types
// =============================================================================

/**
 * Voice input mode
 */
export type VoiceInputMode = 'push-to-talk' | 'continuous';

/**
 * Voice settings stored in preferences
 */
export interface VoiceSettings {
  /** Input mode */
  inputMode: VoiceInputMode;
  /** Recognition language */
  recognitionLanguage: SupportedLanguage;
  /** Synthesis language */
  synthesisLanguage: SupportedLanguage;
  /** Speech rate for TTS */
  speechRate: number;
  /** Speech pitch for TTS */
  speechPitch: number;
  /** Preferred voice URI for TTS */
  preferredVoiceURI?: string;
  /** Enable auto-play for assistant messages */
  autoPlayAssistant: boolean;
  /** Enable voice commands */
  enableVoiceCommands: boolean;
  /** Show confidence scores */
  showConfidenceScores: boolean;
}

/**
 * Default voice settings
 */
export const DEFAULT_VOICE_SETTINGS: Readonly<VoiceSettings> = {
  inputMode: 'push-to-talk',
  recognitionLanguage: 'en-US',
  synthesisLanguage: 'en-US',
  speechRate: 1,
  speechPitch: 1,
  autoPlayAssistant: false,
  enableVoiceCommands: true,
  showConfidenceScores: false,
};

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for useVoiceInput hook
 */
export interface UseVoiceInputReturn {
  /** Whether speech recognition is active */
  isListening: boolean;
  /** Final transcript */
  transcript: string;
  /** Interim (not yet finalized) transcript */
  interimTranscript: string;
  /** Full transcript including interim results */
  fullTranscript: string;
  /** Recognition error if any */
  error: SpeechRecognitionError | null;
  /** Confidence score of last result (0-1) */
  confidence: number | null;
  /** Whether browser supports speech recognition */
  isSupported: boolean;
  /** Start listening */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Toggle listening state */
  toggleListening: () => void;
  /** Reset transcript and error */
  reset: () => void;
  /** Set transcript manually */
  setTranscript: (transcript: string) => void;
}

/**
 * Return type for useVoiceOutput hook
 */
export interface UseVoiceOutputReturn {
  /** Whether speech synthesis is active */
  isSpeaking: boolean;
  /** Whether synthesis is paused */
  isPaused: boolean;
  /** Available voices */
  voices: TTSVoice[];
  /** Current voice */
  currentVoice: TTSVoice | null;
  /** Whether browser supports speech synthesis */
  isSupported: boolean;
  /** Speak text */
  speak: (text: string, options?: Partial<TTSSynthesisOptions>) => void;
  /** Stop speaking */
  cancel: () => void;
  /** Pause speaking */
  pause: () => void;
  /** Resume speaking */
  resume: () => void;
  /** Set voice by URI */
  setVoice: (voiceURI: string) => void;
  /** Set speech rate */
  setRate: (rate: number) => void;
  /** Set speech pitch */
  setPitch: (pitch: number) => void;
}

/**
 * Return type for useVoiceCommands hook
 */
export interface UseVoiceCommandsReturn {
  /** Registered commands */
  commands: VoiceCommand[];
  /** Last recognized command */
  lastCommand: string | null;
  /** Whether voice commands are enabled */
  isEnabled: boolean;
  /** Register a new command */
  registerCommand: (
    command: Omit<VoiceCommand, 'handler'> & { handler: VoiceCommandHandler }
  ) => void;
  /** Unregister a command */
  unregisterCommand: (id: string) => void;
  /** Enable/disable voice commands */
  setEnabled: (enabled: boolean) => void;
  /** Get help text for all commands */
  getHelpText: () => string;
}

// =============================================================================
// Browser Support Types
// =============================================================================

/**
 * Browser support information for Web Speech API
 */
export interface BrowserSupportInfo {
  /** Whether SpeechRecognition is supported */
  speechRecognition: boolean;
  /** Whether webkitSpeechRecognition is supported */
  webkitSpeechRecognition: boolean;
  /** Whether SpeechSynthesis is supported */
  speechSynthesis: boolean;
  /** Whether continuous recognition is supported */
  continuous: boolean;
  /** Whether interim results are supported */
  interimResults: boolean;
  /** Whether maxAlternatives is supported */
  maxAlternatives: boolean;
  /** Whether grammar list is supported */
  grammarList: boolean;
  /** Overall support level */
  supportLevel: 'full' | 'partial' | 'none';
  /** Browser name */
  browserName: string;
  /** Recommended fallback method */
  recommendedFallback: 'web-api' | 'whisper-api' | 'none';
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Whisper API transcription request
 */
export interface WhisperTranscriptionRequest {
  /** Audio file blob */
  audio: Blob;
  /** Language hint */
  language?: string;
  /** Prompt for transcription context */
  prompt?: string;
}

/**
 * Whisper API transcription response
 */
export interface WhisperTranscriptionResponse {
  /** Transcribed text */
  text: string;
  /** Confidence score */
  confidence?: number;
  /** Language detected */
  language?: string;
  /** Duration in seconds */
  duration?: number;
}

/**
 * Audio recording state
 */
export type RecordingState = 'inactive' | 'recording' | 'paused' | 'stopped';

/**
 * Audio level data for visualization
 */
export interface AudioLevelData {
  /** Current volume level (0-1) */
  level: number;
  /** Frequency data for visualization */
  frequencyData?: Uint8Array<ArrayBuffer>;
  /** Whether audio is currently detected */
  isSpeaking: boolean;
}
