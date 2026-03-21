'use client';

/**
 * PostHog Provider Component
 *
 * Wraps the application with PostHog analytics for client-side tracking.
 * Handles initialization, consent/privacy settings, and automatic page view tracking.
 *
 * Features:
 * - Initializes PostHog only in production (unless explicitly enabled in dev)
 * - Respects user consent preferences
 * - Configures session recording with sampling
 * - Provides automatic page view tracking
 * - Supports feature flags
 */

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { type ReactNode, Suspense, useEffect, useState } from 'react';

// PostHog configuration
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
const IS_DEV = process.env.NODE_ENV === 'development';
const ENABLE_IN_DEV = process.env.NEXT_PUBLIC_ENABLE_POSTHOG_DEV === 'true';

/**
 * Check if PostHog should be enabled
 */
function shouldEnablePostHog(): boolean {
  // Don't enable in development unless explicitly configured
  if (IS_DEV && !ENABLE_IN_DEV) {
    return false;
  }

  // Don't enable if no API key is configured
  if (!POSTHOG_KEY) {
    if (!IS_DEV) {
    }
    return false;
  }

  return true;
}

/**
 * Initialize PostHog client
 */
function initPostHog() {
  if (typeof window === 'undefined') return;
  if (!shouldEnablePostHog()) return;

  // Check for user consent
  const consent = getAnalyticsConsent();
  if (!consent.analytics) {
    return;
  }

  posthog.init(POSTHOG_KEY!, {
    api_host: POSTHOG_HOST,
    // Session recording configuration
    session_recording: {
      // Sample 10% of sessions for recording
      sampleRate: 0.1,
      // Mask sensitive inputs
      maskAllInputs: true,
      // Don't record passwords
      maskInputOptions: {
        password: true,
      },
    },
    // Capture performance metrics
    capture_performance: true,
    // Disable automatic pageviews (we handle this manually for SPA navigation)
    capture_pageview: false,
    // Disable automatic pageleave (we handle this manually)
    capture_pageleave: false,
    // Respect Do Not Track
    respect_dnt: true,
    // Custom properties for all events
    loaded: () => {
      if (IS_DEV) {
      }
    },
    // Persistence based on consent
    persistence: consent.analytics ? 'localStorage+cookie' : 'memory',
    // Disable console logs in production
    disable_persistence: !consent.analytics,
    // Request batching
    request_batching: true,
  });
}

/**
 * Get analytics consent from localStorage
 */
interface ConsentSettings {
  analytics: boolean;
  marketing: boolean;
  necessary: boolean;
}

function getAnalyticsConsent(): ConsentSettings {
  if (typeof window === 'undefined') {
    return { analytics: false, marketing: false, necessary: true };
  }

  try {
    const stored = localStorage.getItem('consent-settings');
    if (stored) {
      return JSON.parse(stored) as ConsentSettings;
    }
  } catch {
    // Ignore localStorage errors
  }

  // Default: allow analytics in production, disable in dev
  return {
    analytics: !IS_DEV,
    marketing: false,
    necessary: true,
  };
}

/**
 * Update analytics consent
 */
export function updateAnalyticsConsent(consent: Partial<ConsentSettings>): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getAnalyticsConsent();
    const updated = { ...current, ...consent };
    localStorage.setItem('consent-settings', JSON.stringify(updated));

    // Update PostHog persistence if already initialized
    if (posthog.__loaded) {
      if (updated.analytics) {
        posthog.opt_in_capturing();
      } else {
        posthog.opt_out_capturing();
      }
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  return getAnalyticsConsent().analytics;
}

/**
 * PostHog Page View Tracker
 * Automatically tracks page views on route changes
 */
function PostHogPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient?.__loaded) {
      // Construct full URL
      const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

      // Capture page view
      posthogClient.capture('$pageview', {
        $current_url: url,
        $pathname: pathname,
        $search_params: searchParams?.toString(),
      });

      if (IS_DEV && ENABLE_IN_DEV) {
      }
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

/**
 * PostHog Session Recorder
 * Manages session recording based on user consent and sampling
 */
function PostHogSessionRecorder(): null {
  const posthogClient = usePostHog();

  useEffect(() => {
    if (!posthogClient?.__loaded) return;

    const consent = getAnalyticsConsent();

    if (consent.analytics) {
      // Start session recording if enabled
      posthogClient.startSessionRecording?.();
    } else {
      // Stop session recording if disabled
      posthogClient.stopSessionRecording?.();
    }
  }, [posthogClient]);

  return null;
}

interface PostHogProviderProps {
  children: ReactNode;
}

/**
 * PostHog Provider Component
 * Wraps children with PostHog context and tracking components
 */
export function PostHogProvider({ children }: PostHogProviderProps): React.ReactElement {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initPostHog();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // If PostHog is not enabled, just render children
  if (!shouldEnablePostHog()) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogSessionRecorder />
      {children}
    </PHProvider>
  );
}

/**
 * Hook to check if PostHog is ready
 */
export function usePostHogReady(): boolean {
  const [isReady, setIsReady] = useState(false);
  const posthogClient = usePostHog();

  useEffect(() => {
    setIsReady(posthogClient?.__loaded ?? false);
  }, [posthogClient]);

  return isReady;
}

// Re-export PostHog hooks for convenience
export { usePostHog } from 'posthog-js/react';
