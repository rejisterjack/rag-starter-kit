/**
 * Plausible Analytics - Server-side Events API
 *
 * Sends server-side events to the Plausible Events API.
 * Use this for tracking events from API routes, server actions, and background jobs.
 *
 * Plausible server-side events require the domain and use the /api/event endpoint.
 */

const PLAUSIBLE_HOST = process.env.NEXT_PUBLIC_ANALYTICS_HOST;
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || 'localhost';

/**
 * Track an event server-side via the Plausible Events API
 */
export async function trackEvent(
  event: string,
  properties: Record<string, unknown> = {},
  _distinctId?: string
): Promise<void> {
  if (!PLAUSIBLE_HOST) return;

  try {
    await fetch(`${PLAUSIBLE_HOST}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: event,
        domain: PLAUSIBLE_DOMAIN,
        url: `http://${PLAUSIBLE_DOMAIN}/server`,
        props: properties,
      }),
    });
  } catch {
    // Silently fail — analytics should never break the app
  }
}

/** No-op for Plausible (user identity is managed client-side) */
export async function identifyUser(
  _distinctId: string,
  _properties: Record<string, unknown> = {}
): Promise<void> {}

/** No-op */
export async function aliasUser(_distinctId: string, _alias: string): Promise<void> {}

/** No-op */
export async function setGroupProperties(
  _groupType: string,
  _groupKey: string,
  _properties: Record<string, unknown> = {}
): Promise<void> {}

/** No-op — Plausible has no flush concept */
export async function flushAnalytics(): Promise<void> {}

/** No-op */
export async function shutdownAnalytics(): Promise<void> {}

// ---------------------------------------------------------------------------
// Convenience methods (same API shape as before)
// ---------------------------------------------------------------------------

export const trackChat = {
  started: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('chat_started', { userId, ...properties }),
  completed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('chat_completed', { userId, ...properties }),
  error: (userId: string, error: Error, properties?: Record<string, unknown>) =>
    trackEvent('chat_error', { userId, error: error.message, ...properties }),
  messageSent: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('message_sent', { userId, ...properties }),
  messageReceived: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('message_received', { userId, ...properties }),
};

export const trackDocument = {
  uploaded: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_uploaded', { userId, ...properties }),
  processed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_processed', { userId, ...properties }),
  deleted: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_deleted', { userId, ...properties }),
  searched: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_search', { userId, ...properties }),
};

export const trackAuth = {
  signup: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('user_signup', { userId, ...properties }),
  login: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('user_login', { userId, ...properties }),
  logout: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('user_logout', { userId, ...properties }),
};

export const trackFeature = {
  voiceUsed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('voice_used', { userId, ...properties }),
  exportUsed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('export_used', { userId, ...properties }),
  searchUsed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('search_used', { userId, ...properties }),
  integrationConnected: (
    userId: string,
    integration: string,
    properties?: Record<string, unknown>
  ) => trackEvent('integration_connected', { userId, integration, ...properties }),
  apiKeyCreated: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('api_key_created', { userId, ...properties }),
};

export const trackRAG = {
  retrievalLatency: (userId: string, latencyMs: number, properties?: Record<string, unknown>) =>
    trackEvent('retrieval_latency', { userId, latency_ms: latencyMs, ...properties }),
  tokensUsed: (userId: string, tokens: number, properties?: Record<string, unknown>) =>
    trackEvent('tokens_used', { userId, tokens, ...properties }),
  costIncurred: (userId: string, cost: number, properties?: Record<string, unknown>) =>
    trackEvent('cost_incurred', { userId, cost_usd: cost, ...properties }),
};
