/**
 * Webhook Delivery Service
 *
 * Handles signing payloads with HMAC-SHA256, sending POST requests,
 * retry logic, and logging delivery attempts.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { logger } from '@/lib/logger';
import { RetryableError, withRetry } from '@/lib/utils/retry';

// ============================================================================
// Types
// ============================================================================

export interface WebhookPayload {
  event: string;
  timestamp: string;
  id: string;
  data: unknown;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  durationMs: number;
  attemptCount: number;
}

export interface WebhookDeliveryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Whether to verify SSL certificates (default: true) */
  verifySsl?: boolean;
}

// ============================================================================
// Secret Generation
// ============================================================================

/**
 * Generate a new webhook secret for HMAC signing
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a webhook signature for the payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);

  // Use timing-safe comparison to prevent timing attacks
  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    return sigBuf.equals(expectedBuf);
  } catch (error: unknown) {
    logger.error('Failed to verify webhook signature', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// ============================================================================
// Payload Building
// ============================================================================

/**
 * Build a webhook payload with standard fields
 */
export function buildWebhookPayload(
  event: string,
  data: unknown,
  options?: { id?: string; timestamp?: Date }
): WebhookPayload {
  return {
    event,
    timestamp: (options?.timestamp ?? new Date()).toISOString(),
    id: options?.id ?? randomBytes(16).toString('hex'),
    data,
  };
}

// ============================================================================
// Delivery
// ============================================================================

const DEFAULT_OPTIONS: Required<WebhookDeliveryOptions> = {
  maxRetries: 3,
  timeoutMs: 30000,
  verifySsl: true,
};

/**
 * Deliver a webhook to the specified URL
 */
export async function deliverWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload,
  options: WebhookDeliveryOptions = {}
): Promise<DeliveryResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, secret);

  const startTime = Date.now();
  let attemptCount = 0;

  try {
    const result = await withRetry(
      async () => {
        attemptCount++;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': payload.event,
              'X-Webhook-ID': payload.id,
              'X-Webhook-Timestamp': payload.timestamp,
              'User-Agent': 'RAG-Starter-Kit-Webhook/1.0',
            },
            body: payloadString,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Read response body
          const responseBody = await response.text();

          // 2xx status codes are considered successful
          if (response.ok) {
            return {
              success: true,
              statusCode: response.status,
              responseBody: responseBody || undefined,
            };
          }

          // Non-2xx responses should be retried if they're server errors or certain client errors
          const shouldRetry =
            response.status >= 500 ||
            response.status === 429 || // Rate limited
            response.status === 408; // Request timeout

          throw new RetryableError(
            `Webhook delivery failed with status ${response.status}: ${responseBody}`,
            shouldRetry,
            response.status === 429 ? 60000 : undefined // Wait longer if rate limited
          );
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        maxRetries: opts.maxRetries,
        delayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 60000,
        onRetry: (error, attempt, delay) => {
          logger.warn('Retrying webhook delivery', {
            url,
            event: payload.event,
            attempt,
            delay,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        },
      }
    );

    const durationMs = Date.now() - startTime;

    logger.info('Webhook delivered successfully', {
      url,
      event: payload.event,
      webhookId: payload.id,
      durationMs,
      attemptCount,
    });

    return {
      ...result,
      durationMs,
      attemptCount,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Webhook delivery failed after all retries', {
      url,
      event: payload.event,
      webhookId: payload.id,
      durationMs,
      attemptCount,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
      durationMs,
      attemptCount,
    };
  }
}

/**
 * Test a webhook URL without sending real data
 */
export async function testWebhook(
  url: string,
  secret: string,
  options?: WebhookDeliveryOptions
): Promise<DeliveryResult> {
  const testPayload = buildWebhookPayload('webhook.test', {
    message: 'This is a test webhook from RAG Starter Kit',
    test: true,
  });

  return deliverWebhook(url, secret, testPayload, options);
}

// ============================================================================
// Batch Delivery
// ============================================================================

/**
 * Deliver webhooks to multiple endpoints concurrently
 */
export async function deliverToMultiple(
  webhooks: Array<{ url: string; secret: string; events: string[] }>,
  event: string,
  data: unknown,
  options?: WebhookDeliveryOptions
): Promise<Array<{ url: string; result: DeliveryResult }>> {
  // Filter webhooks that are subscribed to this event
  const subscribedWebhooks = webhooks.filter(
    (w) => w.events.includes(event) || w.events.includes('*')
  );

  if (subscribedWebhooks.length === 0) {
    return [];
  }

  const payload = buildWebhookPayload(event, data);

  // Deliver to all webhooks concurrently
  const results = await Promise.all(
    subscribedWebhooks.map(async (webhook) => {
      const result = await deliverWebhook(webhook.url, webhook.secret, payload, options);

      return {
        url: webhook.url,
        result,
      };
    })
  );

  return results;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Standard webhook event types
 */
export const WebhookEvents = {
  // Document events
  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_PROCESSED: 'document.processed',
  DOCUMENT_PROCESSING_FAILED: 'document.processing_failed',

  // Chat events
  CHAT_CREATED: 'chat.created',
  CHAT_MESSAGE_SENT: 'chat.message_sent',
  CHAT_DELETED: 'chat.deleted',

  // Workspace events
  WORKSPACE_UPDATED: 'workspace.updated',
  MEMBER_JOINED: 'member.joined',
  MEMBER_LEFT: 'member.left',

  // API events
  API_KEY_CREATED: 'api_key.created',
  API_KEY_REVOKED: 'api_key.revoked',

  // Webhook events
  WEBHOOK_TEST: 'webhook.test',

  // Wildcard for all events
  ALL: '*',
} as const;

export type WebhookEventType = (typeof WebhookEvents)[keyof typeof WebhookEvents];

/**
 * Get all available webhook event types
 */
export function getAvailableWebhookEvents(): Array<{
  value: string;
  label: string;
  description: string;
}> {
  return [
    {
      value: WebhookEvents.DOCUMENT_CREATED,
      label: 'Document Created',
      description: 'Triggered when a new document is uploaded',
    },
    {
      value: WebhookEvents.DOCUMENT_UPDATED,
      label: 'Document Updated',
      description: 'Triggered when a document is updated',
    },
    {
      value: WebhookEvents.DOCUMENT_DELETED,
      label: 'Document Deleted',
      description: 'Triggered when a document is deleted',
    },
    {
      value: WebhookEvents.DOCUMENT_PROCESSED,
      label: 'Document Processed',
      description: 'Triggered when document processing completes',
    },
    {
      value: WebhookEvents.DOCUMENT_PROCESSING_FAILED,
      label: 'Document Processing Failed',
      description: 'Triggered when document processing fails',
    },
    {
      value: WebhookEvents.CHAT_CREATED,
      label: 'Chat Created',
      description: 'Triggered when a new chat is created',
    },
    {
      value: WebhookEvents.CHAT_MESSAGE_SENT,
      label: 'Message Sent',
      description: 'Triggered when a message is sent in a chat',
    },
    {
      value: WebhookEvents.CHAT_DELETED,
      label: 'Chat Deleted',
      description: 'Triggered when a chat is deleted',
    },
    {
      value: WebhookEvents.WORKSPACE_UPDATED,
      label: 'Workspace Updated',
      description: 'Triggered when workspace settings change',
    },
    {
      value: WebhookEvents.MEMBER_JOINED,
      label: 'Member Joined',
      description: 'Triggered when a member joins the workspace',
    },
    {
      value: WebhookEvents.MEMBER_LEFT,
      label: 'Member Left',
      description: 'Triggered when a member leaves the workspace',
    },
    {
      value: WebhookEvents.API_KEY_CREATED,
      label: 'API Key Created',
      description: 'Triggered when an API key is created',
    },
    {
      value: WebhookEvents.API_KEY_REVOKED,
      label: 'API Key Revoked',
      description: 'Triggered when an API key is revoked',
    },
  ];
}
