'use client';

/**
 * Plausible Analytics Provider
 *
 * Lightweight, privacy-focused analytics that runs self-hosted in Docker.
 * Alternative to PostHog for development and simple use cases.
 *
 * Features:
 * - No cookies required
 * - Privacy-focused (GDPR compliant)
 * - Lightweight script
 * - Self-hosted (data stays with you)
 */

import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { type ReactNode, Suspense, useEffect } from 'react';

// Plausible configuration
const PLAUSIBLE_HOST = process.env.NEXT_PUBLIC_ANALYTICS_HOST;
const PLAUSIBLE_SCRIPT_URL = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL;

/**
 * Check if Plausible is configured
 */
function isPlausibleConfigured(): boolean {
  return !!PLAUSIBLE_HOST && !!PLAUSIBLE_SCRIPT_URL;
}

/**
 * Plausible Page View Tracker
 */
function PlausiblePageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPlausibleConfigured()) return;

    // Track page view
    const plausible = (
      window as unknown as { plausible?: (event: string, props?: { u?: string }) => void }
    ).plausible;
    if (plausible) {
      const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
      plausible('pageview', { u: url });
    }
  }, [pathname, searchParams]);

  return null;
}

interface PlausibleProviderProps {
  children: ReactNode;
}

/**
 * Plausible Provider Component
 */
export function PlausibleProvider({ children }: PlausibleProviderProps): React.ReactElement {
  // If Plausible is not configured, just render children
  if (!isPlausibleConfigured()) {
    return <>{children}</>;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        data-domain={typeof window !== 'undefined' ? window.location.host : 'localhost'}
        data-api={`${PLAUSIBLE_HOST}/api/event`}
        src={PLAUSIBLE_SCRIPT_URL}
      />
      <Suspense fallback={null}>
        <PlausiblePageView />
      </Suspense>
      {children}
    </>
  );
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, props?: Record<string, string | number>): void {
  if (typeof window === 'undefined') return;
  const plausible = (
    window as unknown as {
      plausible?: (event: string, props?: { props?: Record<string, string | number> }) => void;
    }
  ).plausible;
  if (plausible) {
    plausible(eventName, { props });
  }
}

/**
 * Hook to check if Plausible is ready
 */
export function usePlausibleReady(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { plausible?: unknown }).plausible;
}
