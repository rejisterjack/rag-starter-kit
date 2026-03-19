/**
 * Voice Module - exports all voice-related functionality
 */

// Types
export type {
  // Speech Recognition
  SupportedLanguage,
  LanguageOption,
  SpeechRecognitionOptions,
  SpeechRecognitionAlternative,
  SpeechRecognitionResult,
  SpeechRecognitionErrorType,
  SpeechRecognitionError,
  
  // Text-to-Speech
  TTSVoice,
  TTSSynthesisOptions,
  TTSEventType,
  TTSEventCallback,
  
  // Voice Commands
  VoiceCommand,
  VoiceCommandHandler,
  BuiltInVoiceCommand,
  
  // Voice Settings
  VoiceInputMode,
  VoiceSettings,
  
  // Hook Returns
  UseVoiceInputReturn,
  UseVoiceOutputReturn,
  UseVoiceCommandsReturn,
  
  // Browser Support
  BrowserSupportInfo,
  
  // API
  WhisperTranscriptionRequest,
  WhisperTranscriptionResponse,
  RecordingState,
  AudioLevelData,
} from './types';

// Values
export {
  DEFAULT_VOICE_SETTINGS,
} from './types';

// Browser Support
export {
  SUPPORTED_LANGUAGES,
  getLanguageByCode,
  getLanguageName,
  detectBrowser,
  isMobileDevice,
  isIOS,
  checkBrowserSupport,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  requestMicrophonePermission,
  getMicrophonePermissionStatus,
  getUnsupportedMessage,
  getWindow,
  getNavigator,
  isClient,
} from './browser-support';

// Speech Service
export {
  SpeechService,
  getSpeechService,
  resetSpeechService,
} from './speech-service';
