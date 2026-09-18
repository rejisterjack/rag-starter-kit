/**
 * Global type declarations for browser API extensions.
 *
 * Extends built-in browser interfaces (Window, Navigator, ServiceWorkerRegistration)
 * so that vendor-prefixed and application-specific properties are properly typed,
 * eliminating the need for `as unknown as` casts throughout the codebase.
 *
 * NOTE: SpeechRecognition / webkitSpeechRecognition / SpeechGrammarList /
 *       webkitSpeechGrammarList are declared in src/types/index.ts using
 *       project-local types (SpeechRecognitionInstance, SpeechGrammarListInstance).
 *       Do NOT re-declare them here.
 */

interface Window {
  /** Plausible Analytics helper injected by the Plausible script. */
  plausible?: (
    event: string,
    props?: { u?: string; props?: Record<string, string | number | boolean> }
  ) => void;

  /** WebKit-prefixed AudioContext (Safari). */
  webkitAudioContext?: typeof AudioContext;

  /** Stored service-worker registration reference for app-wide access. */
  __SW_REGISTRATION__?: ServiceWorkerRegistration;
}

interface Navigator {
  /** iOS Safari standalone mode flag (true when app is added to Home Screen). */
  standalone?: boolean;
}

interface ServiceWorkerRegistration {
  /** Background Sync API (Chrome). */
  sync?: {
    register: (tag: string) => Promise<void>;
  };
}
