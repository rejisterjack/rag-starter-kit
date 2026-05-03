/**
 * Webhook Idempotency
 *
 * Ensures webhook events are processed exactly once by storing
 * idempotency keys with expiration.
 */

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

// ============================================================================
// Types
// ============================================================================

export interface IdempotencyKey {
  key: string;
  event: string;
  webhookId: string;
  createdAt: Date;
  processed: boolean;
  responseStatus?: number;
}

// ============================================================================
// Configuration
// ============================================================================

const IDEMPOTENCY_KEY_PREFIX = 'webhook:idempotency:';
const DEFAULT_TTL_SECONDS = 86400; // 24 hours

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate an idempotency key for a webhook event
 *
 * The key is composed of: webhookId:event:uniqueId
 * This ensures uniqueness per webhook and event type
 */
export function generateIdempotencyKey(
  webhookId: string,
  event: string,
  uniqueId?: string
): string {
  const id = uniqueId || `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  return `${webhookId}:${event}:${id}`;
}

/**
 * Extract components from an idempotency key
 */
export function parseIdempotencyKey(key: string): {
  webhookId: string;
  event: string;
  uniqueId: string;
} | null {
  const parts = key.split(':');
  if (parts.length < 3) {
    return null;
  }

  return {
    webhookId: parts[0],
    event: parts[1],
    uniqueId: parts.slice(2).join(':'),
  };
}

// ============================================================================
// Idempotency Check
// ============================================================================

/**
 * Check if an idempotency key has been processed
 * @returns Object with processed status and previous response if available
 */
export async function checkIdempotencyKey(key: string): Promise<{
  processed: boolean;
  previousResponse?: {
    status: number;
    body?: string;
  };
}> {
  try {
    const stored = await redis.get(`${IDEMPOTENCY_KEY_PREFIX}${key}`);

    if (!stored) {
      return { processed: false };
    }

    const data = JSON.parse(stored as string);

    return {
      processed: data.processed || false,
      previousResponse: data.responseStatus
        ? {
            status: data.responseStatus,
            body: data.responseBody,
          }
        : undefined,
    };
  } catch (error) {
    logger.error('Failed to check idempotency key', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // If we can't check, assume not processed to avoid dropping events
    return { processed: false };
  }
}

/**
 * Store an idempotency key with optional response data
 */
export async function storeIdempotencyKey(
  key: string,
  data: {
    event: string;
    webhookId: string;
    processed?: boolean;
    responseStatus?: number;
    responseBody?: string;
  },
  ttlSeconds?: number
): Promise<boolean> {
  try {
    const ttl = ttlSeconds || DEFAULT_TTL_SECONDS;
    const storeData = {
      ...data,
      createdAt: new Date().toISOString(),
      processed: data.processed ?? false,
    };

    await redis.set(`${IDEMPOTENCY_KEY_PREFIX}${key}`, JSON.stringify(storeData), { ex: ttl });

    return true;
  } catch (error) {
    logger.error('Failed to store idempotency key', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Mark an idempotency key as processed with response data
 */
export async function markIdempotencyKeyProcessed(
  key: string,
  response: {
    status: number;
    body?: string;
  }
): Promise<boolean> {
  try {
    const existing = await redis.get(`${IDEMPOTENCY_KEY_PREFIX}${key}`);

    if (!existing) {
      // If key doesn't exist, we can't mark it processed
      logger.warn('Attempted to mark non-existent idempotency key as processed', { key });
      return false;
    }

    const data = JSON.parse(existing as string);

    // Re-read TTL and set with same expiry
    const ttlResult = await redis.ttl(`${IDEMPOTENCY_KEY_PREFIX}${key}`);
    const ttlValue = typeof ttlResult === 'number' && ttlResult > 0 ? ttlResult : 3600;
    await redis.set(
      `${IDEMPOTENCY_KEY_PREFIX}${key}`,
      JSON.stringify({
        ...data,
        processed: true,
        responseStatus: response.status,
        responseBody: response.body,
        processedAt: new Date().toISOString(),
      }),
      { ex: ttlValue }
    );

    return true;
  } catch (error) {
    logger.error('Failed to mark idempotency key as processed', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Delete an idempotency key (for manual cleanup)
 */
export async function deleteIdempotencyKey(key: string): Promise<boolean> {
  try {
    await redis.del(`${IDEMPOTENCY_KEY_PREFIX}${key}`);
    return true;
  } catch (error) {
    logger.error('Failed to delete idempotency key', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// ============================================================================
// Webhook Event Deduplication
// ============================================================================

/**
 * Check if a webhook event is a duplicate
 *
 * Usage:
 * ```typescript
 * const isDuplicate = await isDuplicateEvent(webhookId, event, eventId);
 * if (isDuplicate) {
 *   return { success: true, deduplicated: true };
 * }
 * ```
 */
export async function isDuplicateEvent(
  webhookId: string,
  event: string,
  eventId: string
): Promise<boolean> {
  const idempotencyKey = generateIdempotencyKey(webhookId, event, eventId);
  const result = await checkIdempotencyKey(idempotencyKey);

  return result.processed;
}

/**
 * Process webhook event with idempotency guarantee
 *
 * This function ensures the handler is only executed once for each unique event.
 * If the event was already processed, it returns the cached response.
 */
export async function processWithIdempotency<T>(
  webhookId: string,
  event: string,
  eventId: string,
  handler: () => Promise<T>,
  options?: {
    ttlSeconds?: number;
    onDuplicate?: (previousResponse?: { status: number; body?: string }) => T;
  }
): Promise<T> {
  const idempotencyKey = generateIdempotencyKey(webhookId, event, eventId);

  // Check if already processed
  const check = await checkIdempotencyKey(idempotencyKey);

  if (check.processed) {
    logger.info('Duplicate webhook event detected, returning cached response', {
      webhookId,
      event,
      eventId,
    });

    if (options?.onDuplicate) {
      return options.onDuplicate(check.previousResponse);
    }

    // Default behavior: throw duplicate error
    throw new IdempotencyError('Event already processed', check.previousResponse);
  }

  // Store initial key
  await storeIdempotencyKey(
    idempotencyKey,
    {
      event,
      webhookId,
      processed: false,
    },
    options?.ttlSeconds
  );

  try {
    // Execute handler
    const result = await handler();

    // Mark as processed
    await markIdempotencyKeyProcessed(idempotencyKey, {
      status: 200,
      body: JSON.stringify(result),
    });

    return result;
  } catch (error) {
    // Don't mark as processed on error - allow retry
    logger.error('Webhook handler failed, not marking as processed', {
      webhookId,
      event,
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Custom error for idempotency conflicts
 */
export class IdempotencyError extends Error {
  constructor(
    message: string,
    public readonly previousResponse?: { status: number; body?: string }
  ) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up expired idempotency keys
 * Redis handles expiration automatically, but this can be used for
 * manual cleanup or migration scenarios.
 */
export async function cleanupIdempotencyKeys(pattern?: string): Promise<number> {
  try {
    const matchPattern = pattern || `${IDEMPOTENCY_KEY_PREFIX}*`;
    const keys = (await redis.keys(matchPattern)) as string[];

    if (keys.length === 0) {
      return 0;
    }

    // Delete all matching keys
    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }

    await pipeline.exec();

    logger.info('Cleaned up idempotency keys', {
      count: keys.length,
      pattern: matchPattern,
    });

    return keys.length;
  } catch (error) {
    logger.error('Failed to cleanup idempotency keys', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}
