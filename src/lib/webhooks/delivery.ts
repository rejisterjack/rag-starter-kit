/**
 * Webhook Delivery Service
 *
 * Handles signing payloads with HMAC-SHA256, sending POST requests,
 * retry logic, and logging delivery attempts.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { toJson } from '@/lib/db/json';
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
// Delivery Persistence
// ============================================================================

/**
 * Persist a delivery attempt as a WebhookDelivery row.
 *
 * Without this, delivery results lived only in memory and the deliveries
 * page/API always reported 0 records (D-13).
 */
export async function recordDelivery(
  webhookId: string,
  payload: WebhookPayload,
  result: DeliveryResult
): Promise<void> {
  const status = result.success ? 'DELIVERED' : result.attemptCount > 1 ? 'RETRYING' : 'FAILED';

  try {
    const { prisma } = await import('@/lib/db/client');
    const completedAt = new Date();

    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event: payload.event,
        payload: toJson(payload),
        statusCode: result.statusCode ?? null,
        response: result.responseBody ? result.responseBody.slice(0, 2000) : null,
        error: result.error ?? null,
        startedAt: new Date(completedAt.getTime() - result.durationMs),
        completedAt,
        durationMs: result.durationMs,
        status,
        retryCount: Math.max(0, result.attemptCount - 1),
      },
    });
  } catch (error) {
    // Persistence is best-effort — a logging failure must not break delivery
    logger.error('Failed to record webhook delivery', {
      webhookId,
      event: payload.event,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
// Event Types (canonical definitions live in ./events so client components
// can import them without pulling in server-only modules)
// ============================================================================

export type { WebhookEventType } from './events';
export { getAvailableWebhookEvents, WebhookEvents } from './events';
