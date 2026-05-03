/**
 * Graceful Degradation
 *
 * Redis-backed feature flag system that tracks degraded features.
 * Circuit breakers can auto-mark features as degraded when they open,
 * allowing the application to serve reduced responses instead of errors.
 */

import { logger } from '@/lib/logger';
import { isRedisConfigured, redis } from '@/lib/redis';

export type DegradableFeature = 'llm_generation' | 'vector_search' | 'file_upload' | 'webhooks';

const KEY_PREFIX = 'degraded:';

/**
 * Check if a feature is currently marked as degraded.
 */
export async function isFeatureDegraded(feature: DegradableFeature): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  try {
    const result = await redis.get(`${KEY_PREFIX}${feature}`);
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Mark a feature as degraded for a specified duration.
 */
export async function markFeatureDegraded(
  feature: DegradableFeature,
  durationMs: number
): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redis.set(`${KEY_PREFIX}${feature}`, String(Date.now()), { px: durationMs });
    logger.warn('Feature marked as degraded', { feature, durationMs });
  } catch (error) {
    logger.debug('Failed to mark feature as degraded', {
      feature,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * Clear a degraded feature flag.
 */
export async function clearFeatureDegraded(feature: DegradableFeature): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redis.del(`${KEY_PREFIX}${feature}`);
  } catch {
    // Non-critical
  }
}
