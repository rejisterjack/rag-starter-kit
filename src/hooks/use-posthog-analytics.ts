'use client';

/**
 * PostHog Analytics Hooks
 *
 * Custom hooks for product analytics using PostHog.
 * These hooks provide a type-safe way to track events, identify users,
 * and work with feature flags.
 *
 * @example
 * ```tsx
 * // Track a custom event
 * const { track } = useTrackEvent();
 * track('button_clicked', { button_name: 'signup' });
 *
 * // Identify a user
 * const { identify } = useIdentify();
 * identify('user_123', { email: 'user@example.com', plan: 'pro' });
 *
 * // Use feature flags
 * const newFeature = useFeatureFlag('new-feature', false);
 * if (newFeature) {
 *   return <NewFeature />;
 * }
 * ```
 */

import { usePostHog } from 'posthog-js/react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// useTrackEvent - Track custom events
// ============================================================================

export interface TrackEventOptions {
  /** Additional properties to send with the event */
  properties?: Record<string, unknown>;
}

/**
 * Hook for tracking custom events
 *
 * @example
 * ```tsx
 * function PurchaseButton() {
 *   const { track } = useTrackEvent();
 *
 *   const handlePurchase = () => {
 *     track('purchase_initiated', {
 *       product_id: 'prod_123',
 *       price: 99.99,
 *       currency: 'USD'
 *     });
 *     // ... handle purchase
 *   };
 *
 *   return <button onClick={handlePurchase}>Buy Now</button>;
 * }
 * ```
 */
export function useTrackEvent() {
  const posthog = usePostHog();

  const track = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      if (!posthog?.__loaded) {
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }

      posthog.capture(eventName, properties);
    },
    [posthog]
  );

  return { track };
}

// ============================================================================
// useIdentify - Identify users
// ============================================================================

export interface UserProperties {
  /** User's email address */
  email?: string;
  /** User's display name */
  name?: string;
  /** User's subscription plan */
  plan?: string;
  /** User's role/permissions level */
  role?: string;
  /** Company/organization name */
  company?: string;
  /** When the user signed up */
  created_at?: string;
  /** Custom properties */
  [key: string]: unknown;
}

/**
 * Hook for identifying users
 *
 * Call this when a user signs in or when their properties change.
 *
 * @example
 * ```tsx
 * function UserProfile({ user }) {
 *   const { identify, reset } = useIdentify();
 *
 *   useEffect(() => {
 *     if (user) {
 *       identify(user.id, {
 *         email: user.email,
 *         name: user.name,
 *         plan: user.subscription.plan
 *       });
 *     }
 *   }, [user, identify]);
 *
 *   const handleLogout = () => {
 *     reset();
 *     // ... logout logic
 *   };
 *
 *   return <button onClick={handleLogout}>Logout</button>;
 * }
 * ```
 */
export function useIdentify() {
  const posthog = usePostHog();

  const identify = useCallback(
    (distinctId: string, properties?: UserProperties) => {
      if (!posthog?.__loaded) {
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }

      posthog.identify(distinctId, properties);
    },
    [posthog]
  );

  const reset = useCallback(() => {
    if (!posthog?.__loaded) return;
    posthog.reset();
  }, [posthog]);

  const alias = useCallback(
    (alias: string) => {
      if (!posthog?.__loaded) return;
      posthog.alias(alias);
    },
    [posthog]
  );

  return { identify, reset, alias };
}

// ============================================================================
// usePageView - Manual page view tracking
// ============================================================================

export interface PageViewProperties {
  /** Page title */
  title?: string;
  /** Page URL (defaults to current URL) */
  url?: string;
  /** Referrer URL */
  referrer?: string;
  /** Custom properties */
  [key: string]: unknown;
}

/**
 * Hook for manual page view tracking
 *
 * Use this for SPAs with custom routing or when you want to track
 * specific views that aren't captured by automatic page view tracking.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { trackPageView } = usePageView();
 *
 *   useEffect(() => {
 *     trackPageView('Dashboard', {
 *       section: 'analytics',
 *       filters: 'last_7_days'
 *     });
 *   }, [trackPageView]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function usePageView() {
  const posthog = usePostHog();

  const trackPageView = useCallback(
    (pageName: string, properties?: PageViewProperties) => {
      if (!posthog?.__loaded) {
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }

      posthog.capture('$pageview', {
        $page_name: pageName,
        ...properties,
      });
    },
    [posthog]
  );

  const trackPageLeave = useCallback(
    (pageName: string, properties?: Record<string, unknown>) => {
      if (!posthog?.__loaded) return;

      posthog.capture('$pageleave', {
        $page_name: pageName,
        ...properties,
      });
    },
    [posthog]
  );

  return { trackPageView, trackPageLeave };
}

// ============================================================================
// useFeatureFlag - Feature flag support
// ============================================================================

export type FeatureFlagValue = string | boolean | undefined;

/**
 * Hook for checking feature flags
 *
 * @param flagKey - The feature flag key
 * @param defaultValue - Default value if flag is not available
 * @returns The feature flag value
 *
 * @example
 * ```tsx
 * function ChatInterface() {
 *   const enableVoice = useFeatureFlag('enable-voice-input', false);
 *   const themeVariant = useFeatureFlag('chat-theme', 'default');
 *
 *   return (
 *     <div className={themeVariant}>
 *       {enableVoice && <VoiceInputButton />}
 *       <ChatInput />
 *     </div>
 *   );
 * }
 * ```
 */
export function useFeatureFlag<T extends FeatureFlagValue>(
  flagKey: string,
  defaultValue: T = undefined as T
): T {
  const posthog = usePostHog();
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (!posthog?.__loaded) return;

    // Get initial value
    const initialValue = posthog.getFeatureFlag(flagKey) as T;
    if (initialValue !== undefined) {
      setValue(initialValue);
    }

    // Listen for flag changes
    return posthog.onFeatureFlags(() => {
      const newValue = posthog.getFeatureFlag(flagKey) as T;
      if (newValue !== undefined) {
        setValue(newValue);
      }
    });
  }, [posthog, flagKey]);

  return value;
}

/**
 * Hook for checking multiple feature flags at once
 *
 * @param flagKeys - Array of feature flag keys
 * @returns Object with flag keys and their values
 *
 * @example
 * ```tsx
 * function App() {
 *   const flags = useFeatureFlags([
 *     'new-dashboard',
 *     'beta-features',
 *     'dark-mode-default'
 *   ]);
 *
 *   return (
 *     <div data-new-dashboard={flags['new-dashboard']}>
 *       ...
 *     </div>
 *   );
 * }
 * ```
 */
export function useFeatureFlags(flagKeys: string[]): Record<string, FeatureFlagValue> {
  const posthog = usePostHog();
  const [flags, setFlags] = useState<Record<string, FeatureFlagValue>>({});

  useEffect(() => {
    if (!posthog?.__loaded) return;

    const updateFlags = () => {
      const newFlags: Record<string, FeatureFlagValue> = {};
      for (const key of flagKeys) {
        newFlags[key] = posthog.getFeatureFlag(key);
      }
      setFlags(newFlags);
    };

    updateFlags();

    // Listen for flag changes
    return posthog.onFeatureFlags(updateFlags);
  }, [posthog, flagKeys]);

  return flags;
}

/**
 * Hook for feature flag payload (for multivariate flags with complex data)
 *
 * @param flagKey - The feature flag key
 * @returns The feature flag payload
 *
 * @example
 * ```tsx
 * function ChatSettings() {
 *   const config = useFeatureFlagPayload('chat-config');
 *
 *   const maxTokens = config?.maxTokens ?? 2000;
 *   const temperature = config?.temperature ?? 0.7;
 *
 *   return <Settings maxTokens={maxTokens} temperature={temperature} />;
 * }
 * ```
 */
export function useFeatureFlagPayload<T = unknown>(flagKey: string): T | undefined {
  const posthog = usePostHog();
  const [payload, setPayload] = useState<T | undefined>(undefined);

  useEffect(() => {
    if (!posthog?.__loaded) return;

    const updatePayload = () => {
      const newPayload = posthog.getFeatureFlagPayload(flagKey) as T;
      setPayload(newPayload);
    };

    updatePayload();

    // Listen for flag changes
    return posthog.onFeatureFlags(updatePayload);
  }, [posthog, flagKey]);

  return payload;
}

// ============================================================================
// useAnalyticsGroups - Group analytics (workspaces/organizations)
// ============================================================================

/**
 * Hook for group analytics
 *
 * Use this to associate events with groups (workspaces, organizations, etc.)
 *
 * @example
 * ```tsx
 * function WorkspaceContext({ workspace, children }) {
 *   const { setGroup } = useAnalyticsGroups();
 *
 *   useEffect(() => {
 *     if (workspace) {
 *       setGroup('workspace', workspace.id, {
 *         name: workspace.name,
 *         plan: workspace.plan,
 *         member_count: workspace.members.length
 *       });
 *     }
 *   }, [workspace, setGroup]);
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function useAnalyticsGroups() {
  const posthog = usePostHog();

  const setGroup = useCallback(
    (groupType: string, groupKey: string, properties?: Record<string, unknown>) => {
      if (!posthog?.__loaded) {
        if (process.env.NODE_ENV === 'development') {
        }
        return;
      }

      posthog.group(groupType, groupKey, properties);
    },
    [posthog]
  );

  return { setGroup };
}

// ============================================================================
// useSessionRecording - Control session recording
// ============================================================================

/**
 * Hook for controlling session recording
 *
 * @example
 * ```tsx
 * function SensitiveForm() {
 *   const { startRecording, stopRecording, isRecording } = useSessionRecording();
 *
 *   useEffect(() => {
 *     // Stop recording when showing sensitive data
 *     stopRecording();
 *
 *     return () => {
 *       // Resume recording when component unmounts
 *       startRecording();
 *     };
 *   }, [startRecording, stopRecording]);
 *
 *   return <form>...</form>;
 * }
 * ```
 */
export function useSessionRecording() {
  const posthog = usePostHog();
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!posthog?.__loaded) return;

    // Check initial recording state
    setIsRecording(posthog.sessionRecordingStarted() ?? false);
  }, [posthog]);

  const startRecording = useCallback(() => {
    if (!posthog?.__loaded) return;
    posthog.startSessionRecording?.();
    setIsRecording(true);
  }, [posthog]);

  const stopRecording = useCallback(() => {
    if (!posthog?.__loaded) return;
    posthog.stopSessionRecording?.();
    setIsRecording(false);
  }, [posthog]);

  return { startRecording, stopRecording, isRecording };
}

// ============================================================================
// useTimeOnPage - Track time spent on page
// ============================================================================

interface UseTimeOnPageOptions {
  /** Minimum time in ms before tracking (default: 5000ms) */
  minTime?: number;
  /** Event name to track (default: 'time_on_page') */
  eventName?: string;
  /** Additional properties */
  properties?: Record<string, unknown>;
}

/**
 * Hook for tracking time spent on a page
 *
 * @example
 * ```tsx
 * function ArticlePage({ article }) {
 *   useTimeOnPage({
 *     minTime: 10000, // Only track if user spends 10+ seconds
 *     eventName: 'article_read_time',
 *     properties: { article_id: article.id }
 *   });
 *
 *   return <article>...</article>;
 * }
 * ```
 */
export function useTimeOnPage(options: UseTimeOnPageOptions = {}) {
  const { track } = useTrackEvent();
  const startTimeRef = useRef<number>(Date.now());
  const hasTrackedRef = useRef(false);

  const { minTime = 5000, eventName = 'time_on_page', properties = {} } = options;

  useEffect(() => {
    startTimeRef.current = Date.now();
    hasTrackedRef.current = false;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !hasTrackedRef.current) {
        const timeSpent = Date.now() - startTimeRef.current;

        if (timeSpent >= minTime) {
          track(eventName, {
            time_spent_ms: timeSpent,
            time_spent_seconds: Math.round(timeSpent / 1000),
            ...properties,
          });
          hasTrackedRef.current = true;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      handleVisibilityChange();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [track, minTime, eventName, properties]);
}

// ============================================================================
// Convenience hooks for common tracking scenarios
// ============================================================================

/**
 * Hook for tracking button clicks with automatic debouncing
 *
 * @example
 * ```tsx
 * function SaveButton() {
 *   const { onClick, isTracking } = useTrackClick('save_document', {
 *     debounceMs: 1000, // Prevent double-tracking
 *   });
 *
 *   return (
 *     <button onClick={onClick} disabled={isTracking}>
 *       Save
 *     </button>
 *   );
 * }
 * ```
 */
export function useTrackClick(
  eventName: string,
  options: {
    debounceMs?: number;
    properties?: Record<string, unknown>;
  } = {}
) {
  const { track } = useTrackEvent();
  const [isTracking, setIsTracking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onClick = useCallback(
    (additionalProps?: Record<string, unknown>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsTracking(true);

      track(eventName, {
        ...options.properties,
        ...additionalProps,
      });

      timeoutRef.current = setTimeout(() => {
        setIsTracking(false);
      }, options.debounceMs ?? 0);
    },
    [track, eventName, options.debounceMs, options.properties]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { onClick, isTracking };
}

/**
 * Hook for tracking form submissions
 *
 * @example
 * ```tsx
 * function ContactForm() {
 *   const { trackSubmit, isSubmitting } = useTrackForm('contact_form_submit');
 *
 *   const handleSubmit = async (data) => {
 *     trackSubmit({ form_data: data });
 *     await submitForm(data);
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useTrackForm(eventName: string) {
  const { track } = useTrackEvent();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trackSubmit = useCallback(
    (properties?: Record<string, unknown>) => {
      setIsSubmitting(true);

      track(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
      });

      // Reset after a short delay
      setTimeout(() => setIsSubmitting(false), 100);
    },
    [track, eventName]
  );

  return { trackSubmit, isSubmitting };
}
