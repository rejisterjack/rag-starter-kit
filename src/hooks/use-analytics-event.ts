'use client';

/**
 * Plausible Analytics Hooks
 *
 * Lightweight analytics hooks that work with Plausible (self-hosted).
 * Provides event tracking, page views, and time-on-page tracking.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// trackEvent — call window.plausible directly
// ---------------------------------------------------------------------------

function callPlausible(event: string, props?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    plausible?: (event: string, opts?: { props?: Record<string, unknown> }) => void;
  };
  w.plausible?.(event, { props });
}

// ---------------------------------------------------------------------------
// useTrackEvent
// ---------------------------------------------------------------------------

export function useTrackEvent() {
  const track = useCallback((eventName: string, properties?: Record<string, unknown>) => {
    callPlausible(eventName, properties as Record<string, string | number | boolean>);
  }, []);
  return { track };
}

// ---------------------------------------------------------------------------
// usePageView — manual page view
// ---------------------------------------------------------------------------

export function usePageView() {
  const trackPageView = useCallback((pageName: string, properties?: Record<string, unknown>) => {
    callPlausible('pageview', { page_name: pageName, ...properties });
  }, []);

  const trackPageLeave = useCallback((pageName: string, properties?: Record<string, unknown>) => {
    callPlausible('pageleave', { page_name: pageName, ...properties });
  }, []);

  return { trackPageView, trackPageLeave };
}

// ---------------------------------------------------------------------------
// useTimeOnPage
// ---------------------------------------------------------------------------

interface UseTimeOnPageOptions {
  minTime?: number;
  eventName?: string;
  properties?: Record<string, unknown>;
}

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

// ---------------------------------------------------------------------------
// useTrackClick — track button clicks with debouncing
// ---------------------------------------------------------------------------

export function useTrackClick(
  eventName: string,
  options: { debounceMs?: number; properties?: Record<string, unknown> } = {}
) {
  const { track } = useTrackEvent();
  const [isTracking, setIsTracking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onClick = useCallback(
    (additionalProps?: Record<string, unknown>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsTracking(true);
      track(eventName, { ...options.properties, ...additionalProps });
      timeoutRef.current = setTimeout(() => setIsTracking(false), options.debounceMs ?? 0);
    },
    [track, eventName, options.debounceMs, options.properties]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { onClick, isTracking };
}

// ---------------------------------------------------------------------------
// useTrackForm
// ---------------------------------------------------------------------------

export function useTrackForm(eventName: string) {
  const { track } = useTrackEvent();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trackSubmit = useCallback(
    (properties?: Record<string, unknown>) => {
      setIsSubmitting(true);
      track(eventName, { ...properties, timestamp: new Date().toISOString() });
      setTimeout(() => setIsSubmitting(false), 100);
    },
    [track, eventName]
  );

  return { trackSubmit, isSubmitting };
}
