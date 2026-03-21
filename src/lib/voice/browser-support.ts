/**
 * Browser Support Detection for Web Speech API
 * Detects Web Speech API support and provides fallback recommendations
 */

import type { BrowserSupportInfo, LanguageOption, SupportedLanguage } from './types';

// =============================================================================
// Language Options
// =============================================================================

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'auto', name: 'Auto-detect', nativeName: 'Auto-detect', flag: '\ud83c\udf10' },
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English (US)',
    flag: '\ud83c\uddfa\ud83c\uddf8',
  },
  {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English (UK)',
    flag: '\ud83c\uddec\ud83c\udde7',
  },
  {
    code: 'en-AU',
    name: 'English (Australia)',
    nativeName: 'English (Australia)',
    flag: '\ud83c\udde6\ud83c\uddfa',
  },
  {
    code: 'en-CA',
    name: 'English (Canada)',
    nativeName: 'English (Canada)',
    flag: '\ud83c\udde8\ud83c\udde6',
  },
  {
    code: 'en-IN',
    name: 'English (India)',
    nativeName: 'English (India)',
    flag: '\ud83c\uddee\ud83c\uddf3',
  },
  {
    code: 'es-ES',
    name: 'Spanish (Spain)',
    nativeName: 'Espanol (Espana)',
    flag: '\ud83c\uddea\ud83c\uddf8',
  },
  {
    code: 'es-MX',
    name: 'Spanish (Mexico)',
    nativeName: 'Espanol (Mexico)',
    flag: '\ud83c\uddf2\ud83c\uddfd',
  },
  {
    code: 'es-AR',
    name: 'Spanish (Argentina)',
    nativeName: 'Espanol (Argentina)',
    flag: '\ud83c\udde6\ud83c\uddf7',
  },
  {
    code: 'fr-FR',
    name: 'French (France)',
    nativeName: 'Francais (France)',
    flag: '\ud83c\uddeb\ud83c\uddf7',
  },
  {
    code: 'fr-CA',
    name: 'French (Canada)',
    nativeName: 'Francais (Canada)',
    flag: '\ud83c\udde8\ud83c\udde6',
  },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '\ud83c\udde9\ud83c\uddea' },
  {
    code: 'de-AT',
    name: 'German (Austria)',
    nativeName: 'Deutsch (Osterreich)',
    flag: '\ud83c\udde6\ud83c\uddf9',
  },
  {
    code: 'de-CH',
    name: 'German (Switzerland)',
    nativeName: 'Deutsch (Schweiz)',
    flag: '\ud83c\udde8\ud83c\udded',
  },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '\ud83c\uddee\ud83c\uddf9' },
  {
    code: 'pt-BR',
    name: 'Portuguese (Brazil)',
    nativeName: 'Portugues (Brasil)',
    flag: '\ud83c\udde7\ud83c\uddf7',
  },
  {
    code: 'pt-PT',
    name: 'Portuguese (Portugal)',
    nativeName: 'Portugues (Portugal)',
    flag: '\ud83c\uddf5\ud83c\uddf9',
  },
  { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', flag: '\ud83c\uddf3\ud83c\uddf1' },
  { code: 'pl-PL', name: 'Polish', nativeName: 'Polski', flag: '\ud83c\uddf5\ud83c\uddf1' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Russkiy', flag: '\ud83c\uddf7\ud83c\uddfa' },
  { code: 'ja-JP', name: 'Japanese', nativeName: 'Nihongo', flag: '\ud83c\uddef\ud83c\uddf5' },
  { code: 'ko-KR', name: 'Korean', nativeName: 'Hangugeo', flag: '\ud83c\uddf0\ud83c\uddf7' },
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: 'Jian Ti Zhong Wen',
    flag: '\ud83c\udde8\ud83c\uddf3',
  },
  {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: 'Fan Ti Zhong Wen',
    flag: '\ud83c\uddf9\ud83c\uddfc',
  },
  {
    code: 'zh-HK',
    name: 'Chinese (Hong Kong)',
    nativeName: 'Xiang Gang Zhong Wen',
    flag: '\ud83c\udded\ud83c\uddf0',
  },
  {
    code: 'ar-SA',
    name: 'Arabic (Saudi Arabia)',
    nativeName: 'Al-Arabiyya',
    flag: '\ud83c\uddf8\ud83c\udde6',
  },
  {
    code: 'ar-AE',
    name: 'Arabic (UAE)',
    nativeName: 'Al-Arabiyya (UAE)',
    flag: '\ud83c\udde6\ud83c\uddea',
  },
  {
    code: 'ar-EG',
    name: 'Arabic (Egypt)',
    nativeName: 'Al-Arabiyya (Misr)',
    flag: '\ud83c\uddea\ud83c\uddec',
  },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'Hindi', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'th-TH', name: 'Thai', nativeName: 'Thai', flag: '\ud83c\uddf9\ud83c\udded' },
  { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tieng Viet', flag: '\ud83c\uddfb\ud83c\uddf3' },
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Turkce', flag: '\ud83c\uddf9\ud83c\uddf7' },
  {
    code: 'id-ID',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '\ud83c\uddee\ud83c\udde9',
  },
];

/**
 * Get language option by code
 */
export function getLanguageByCode(code: SupportedLanguage): LanguageOption | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Get language name by code
 */
export function getLanguageName(code: SupportedLanguage): string {
  const lang = getLanguageByCode(code);
  return lang?.name || code;
}

// =============================================================================
// Browser Detection
// =============================================================================

/**
 * Detect browser name from user agent
 */
export function detectBrowser(): string {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = window.navigator.userAgent.toLowerCase();

  if (
    userAgent.indexOf('chrome') > -1 &&
    userAgent.indexOf('edge') === -1 &&
    userAgent.indexOf('opr') === -1
  ) {
    return 'Chrome';
  } else if (userAgent.indexOf('safari') > -1 && userAgent.indexOf('chrome') === -1) {
    return 'Safari';
  } else if (userAgent.indexOf('firefox') > -1) {
    return 'Firefox';
  } else if (userAgent.indexOf('edge') > -1) {
    return 'Edge';
  } else if (userAgent.indexOf('opr') > -1 || userAgent.indexOf('opera') > -1) {
    return 'Opera';
  }

  return 'Unknown';
}

/**
 * Check if running on mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    window.navigator.userAgent
  );
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

// =============================================================================
// Web Speech API Support Detection
// =============================================================================

/**
 * Check Web Speech API support
 */
export function checkBrowserSupport(): BrowserSupportInfo {
  if (typeof window === 'undefined') {
    return {
      speechRecognition: false,
      webkitSpeechRecognition: false,
      speechSynthesis: false,
      continuous: false,
      interimResults: false,
      maxAlternatives: false,
      grammarList: false,
      supportLevel: 'none',
      browserName: 'unknown',
      recommendedFallback: 'whisper-api',
    };
  }

  const browserName = detectBrowser();

  // Check Speech Recognition support
  const hasSpeechRecognition = 'SpeechRecognition' in window;
  const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;

  // Check Speech Synthesis support
  const hasSpeechSynthesis = 'speechSynthesis' in window;

  // Determine support level
  let supportLevel: 'full' | 'partial' | 'none' = 'none';

  if (hasSpeechRecognition || hasWebkitSpeechRecognition) {
    if (hasSpeechSynthesis) {
      supportLevel = 'full';
    } else {
      supportLevel = 'partial';
    }
  } else if (hasSpeechSynthesis) {
    supportLevel = 'partial';
  }

  // Check specific feature support
  let continuous = false;
  let interimResults = false;
  let maxAlternatives = false;
  let grammarList = false;

  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      continuous = 'continuous' in recognition;
      interimResults = 'interimResults' in recognition;
      maxAlternatives = 'maxAlternatives' in recognition;

      // Check grammar list support
      grammarList = 'SpeechGrammarList' in window || 'webkitSpeechGrammarList' in window;
    }
  } catch {
    // Features not supported
  }

  // Determine recommended fallback
  let recommendedFallback: 'web-api' | 'whisper-api' | 'none' = 'none';

  if (supportLevel === 'none') {
    recommendedFallback = 'whisper-api';
  } else if (supportLevel === 'partial' && !hasSpeechRecognition && !hasWebkitSpeechRecognition) {
    recommendedFallback = 'whisper-api';
  } else {
    recommendedFallback = 'web-api';
  }

  return {
    speechRecognition: hasSpeechRecognition,
    webkitSpeechRecognition: hasWebkitSpeechRecognition,
    speechSynthesis: hasSpeechSynthesis,
    continuous,
    interimResults,
    maxAlternatives,
    grammarList,
    supportLevel,
    browserName,
    recommendedFallback,
  };
}

/**
 * Check if speech recognition is supported
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Check if speech synthesis is supported
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

// =============================================================================
// Permissions
// =============================================================================

/**
 * Request microphone permission
 * Returns true if permission granted, false otherwise
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.mediaDevices) {
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop all tracks immediately (we just needed permission)
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Check microphone permission status
 */
export async function getMicrophonePermissionStatus(): Promise<PermissionState | 'prompt'> {
  if (typeof window === 'undefined' || !navigator.permissions) {
    return 'prompt';
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state;
  } catch {
    return 'prompt';
  }
}

// =============================================================================
// Error Messages
// =============================================================================

/**
 * Get user-friendly error message for unsupported features
 */
export function getUnsupportedMessage(info: BrowserSupportInfo): string | null {
  if (info.supportLevel === 'full') {
    return null;
  }

  if (info.supportLevel === 'none') {
    return `Your browser (${info.browserName}) does not support voice features. Please use Chrome, Edge, or Safari for the best experience, or use the Whisper API fallback.`;
  }

  const missingFeatures: string[] = [];

  if (!info.speechRecognition && !info.webkitSpeechRecognition) {
    missingFeatures.push('speech recognition');
  }

  if (!info.speechSynthesis) {
    missingFeatures.push('text-to-speech');
  }

  if (missingFeatures.length > 0) {
    return `Your browser (${info.browserName}) does not support ${missingFeatures.join(' and ')}. Some voice features may be limited.`;
  }

  return null;
}

// =============================================================================
// SSR Safety
// =============================================================================

/**
 * Safe window access for SSR
 */
export function getWindow(): typeof window | null {
  return typeof window !== 'undefined' ? window : null;
}

/**
 * Safe navigator access for SSR
 */
export function getNavigator(): typeof navigator | null {
  return typeof navigator !== 'undefined' ? navigator : null;
}

/**
 * Check if code is running on client
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}
