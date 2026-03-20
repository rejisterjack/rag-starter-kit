/**
 * Voice Module - exports all voice-related functionality
 */

// Browser Support
export {
  checkBrowserSupport,
  detectBrowser,
  getLanguageByCode,
  getLanguageName,
  getMicrophonePermissionStatus,
  getNavigator,
  getUnsupportedMessage,
  getWindow,
  isClient,
  isIOS,
  isMobileDevice,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  requestMicrophonePermission,
  SUPPORTED_LANGUAGES,
} from './browser-support';
// Speech Service
export {
  getSpeechService,
  resetSpeechService,
  SpeechService,
} from './speech-service';
// VAD (Voice Activity Detection)
export {
  createVAD,
  detectAudioActivity,
  VoiceActivityDetector,
  waitForVoice,
} from './vad';
// Wake Word Detection
export {
  checkWakeWordSupport,
  createWakeWordDetector,
  getDefaultWakeWords,
  WakeWordDetector,
  waitForWakeWord,
  WAKE_WORD_SETS,
} from './wake-word';
// Types
export type {
  AudioLevelData,
  // Browser Support
  BrowserSupportInfo,
  BuiltInVoiceCommand,
  LanguageOption,
  RecordingState,
  SpeechRecognitionAlternative,
  SpeechRecognitionError,
  SpeechRecognitionErrorType,
  SpeechRecognitionOptions,
  SpeechRecognitionResult,
  // Speech Recognition
  SupportedLanguage,
  TTSEventCallback,
  TTSEventType,
  TTSSynthesisOptions,
  // Text-to-Speech
  TTSVoice,
  UseVoiceCommandsReturn,
  // Hook Returns
  UseVoiceInputReturn,
  UseVoiceOutputReturn,
  // Voice Commands
  VoiceCommand,
  VoiceCommandHandler,
  // Voice Settings
  VoiceInputMode,
  VoiceSettings,
  // API
  WhisperTranscriptionRequest,
  WhisperTranscriptionResponse,
} from './types';
// VAD Types
export type {
  VADEvent,
  VADEventHandler,
  VADEventType,
  VADOptions,
  VADState,
  VADStateChangeHandler,
} from './vad';
// Wake Word Types
export type {
  WakeWordEvent,
  WakeWordEventHandler,
  WakeWordEventType,
  WakeWordOptions,
  WakeWordState,
  WakeWordStateChangeHandler,
} from './wake-word';
// Values
export { DEFAULT_VOICE_SETTINGS } from './types';
