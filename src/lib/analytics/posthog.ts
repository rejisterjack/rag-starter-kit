/**
 * PostHog Analytics - Server-side
 *
 * This module provides server-side analytics tracking using PostHog.
 * Use this for tracking events from API routes, server actions, and background jobs.
 *
 * Key Events to Track:
 * - Chat Events:
 *   - chat_started: User starts a new chat conversation
 *   - chat_completed: AI response completed successfully
 *   - chat_error: Error during chat processing
 *   - message_sent: User sends a message
 *   - message_received: AI responds to user message
 *
 * - Document Events:
 *   - document_uploaded: User uploads a document
 *   - document_processed: Document successfully processed
 *   - document_deleted: User deletes a document
 *   - document_search: User searches within documents
 *
 * - User Events:
 *   - user_signup: New user registration
 *   - user_login: User signs in
 *   - user_logout: User signs out
 *   - user_invited: User invites team member
 *   - user_profile_updated: User updates profile
 *
 * - Workspace Events:
 *   - workspace_created: New workspace created
 *   - workspace_joined: User joins workspace
 *   - workspace_settings_changed: Workspace configuration updated
 *
 * - Feature Usage:
 *   - voice_used: Voice input/output used
 *   - export_used: Conversation/document exported
 *   - search_used: Global search feature used
 *   - integration_connected: Third-party integration connected
 *   - api_key_created: API key generated
 *   - webhook_configured: Webhook setup completed
 *
 * - RAG Performance:
 *   - retrieval_latency: Time to retrieve relevant chunks
 *   - reranking_score: Quality score from reranking
 *   - tokens_used: Total tokens consumed
 *   - cost_incurred: Cost of API calls
 */

import { PostHog } from 'posthog-node';

// Initialize PostHog client
const posthogApiKey = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let posthogClient: PostHog | null = null;

/**
 * Get or create the PostHog client instance
 */
export function getPostHogClient(): PostHog | null {
  // Skip in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_POSTHOG_DEV) {
    return null;
  }

  if (!posthogApiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[PostHog] API key not configured');
    }
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(posthogApiKey, {
      host: posthogHost,
      flushAt: 20, // Flush after 20 events
      flushInterval: 10000, // Flush every 10 seconds
    });

    // Enable debug mode in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      posthogClient.debug();
    }
  }

  return posthogClient;
}

/**
 * Track an event server-side
 *
 * @param event - Event name
 * @param properties - Event properties
 * @param distinctId - Optional user identifier
 * @param groups - Optional group analytics (workspace/organization)
 */
export async function trackEvent(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId?: string,
  groups?: Record<string, string>
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  const eventPayload: {
    event: string;
    properties: Record<string, unknown>;
    distinctId?: string;
    groups?: Record<string, string>;
  } = {
    event,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      $lib_version: 'unknown',
      environment: process.env.NODE_ENV,
    },
  };

  if (distinctId) {
    eventPayload.distinctId = distinctId;
  }

  if (groups) {
    eventPayload.groups = groups;
  }

  client.capture(eventPayload);
}

/**
 * Identify a user server-side
 *
 * @param distinctId - User identifier
 * @param properties - User properties
 */
export async function identifyUser(
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  client.identify({
    distinctId,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      environment: process.env.NODE_ENV,
    },
  });
}

/**
 * Alias an anonymous user to a known user
 *
 * @param distinctId - New user identifier
 * @param alias - Previous anonymous identifier
 */
export async function aliasUser(distinctId: string, alias: string): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  client.alias({
    distinctId,
    alias,
  });
}

/**
 * Set group properties for group analytics
 *
 * @param groupType - Type of group (e.g., 'workspace', 'organization')
 * @param groupKey - Group identifier
 * @param properties - Group properties
 */
export async function setGroupProperties(
  groupType: string,
  groupKey: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  client.groupIdentify({
    groupType,
    groupKey,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      environment: process.env.NODE_ENV,
    },
  });
}

/**
 * Flush pending events (useful before serverless function ends)
 */
export async function flushPostHog(): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  await client.flush();
}

/**
 * Shutdown PostHog client (call on application shutdown)
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}

// Convenience methods for common events

/**
 * Track chat-related events
 */
export const trackChat = {
  started: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('chat_started', properties, userId),
  completed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('chat_completed', properties, userId),
  error: (userId: string, error: Error, properties?: Record<string, unknown>) =>
    trackEvent('chat_error', { error: error.message, ...properties }, userId),
  messageSent: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('message_sent', properties, userId),
  messageReceived: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('message_received', properties, userId),
};

/**
 * Track document-related events
 */
export const trackDocument = {
  uploaded: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_uploaded', properties, userId),
  processed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_processed', properties, userId),
  deleted: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_deleted', properties, userId),
  searched: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('document_search', properties, userId),
};

/**
 * Track user authentication events
 */
export const trackAuth = {
  signup: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('user_signup', properties, userId),
  login: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('user_login', properties, userId),
  logout: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('user_logout', properties, userId),
};

/**
 * Track feature usage events
 */
export const trackFeature = {
  voiceUsed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('voice_used', properties, userId),
  exportUsed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('export_used', properties, userId),
  searchUsed: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('search_used', properties, userId),
  integrationConnected: (userId: string, integration: string, properties?: Record<string, unknown>) =>
    trackEvent('integration_connected', { integration, ...properties }, userId),
  apiKeyCreated: (userId: string, properties?: Record<string, unknown>) =>
    trackEvent('api_key_created', properties, userId),
};

/**
 * Track RAG performance metrics
 */
export const trackRAG = {
  retrievalLatency: (userId: string, latencyMs: number, properties?: Record<string, unknown>) =>
    trackEvent('retrieval_latency', { latency_ms: latencyMs, ...properties }, userId),
  tokensUsed: (userId: string, tokens: number, properties?: Record<string, unknown>) =>
    trackEvent('tokens_used', { tokens, ...properties }, userId),
  costIncurred: (userId: string, cost: number, properties?: Record<string, unknown>) =>
    trackEvent('cost_incurred', { cost_usd: cost, ...properties }, userId),
};
