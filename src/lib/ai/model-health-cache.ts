/**
 * Model Health Cache
 *
 * Caches model availability status to avoid expensive probe calls on every request.
 * When a model succeeds, it's marked healthy for a configurable TTL.
 * When a model fails, it's marked unhealthy and skipped until the TTL expires.
 *
 * This eliminates the 200-500ms latency penalty of probing on every streaming request.
 */

import { logger } from '@/lib/logger';

interface ModelHealthEntry {
  healthy: boolean;
  lastChecked: number;
  consecutiveFailures: number;
}

// TTL for healthy models (how long we trust a "healthy" status)
const HEALTHY_TTL_MS = 60_000; // 1 minute

// TTL for unhealthy models (how long before we retry a failed model)
const UNHEALTHY_TTL_MS = 30_000; // 30 seconds

// After this many consecutive failures, increase the backoff
const MAX_FAILURES_BEFORE_EXTENDED_BACKOFF = 5;
const EXTENDED_BACKOFF_MS = 120_000; // 2 minutes

class ModelHealthCache {
  private cache = new Map<string, ModelHealthEntry>();

  /**
   * Check if a model is known to be healthy (or unknown/expired status).
   * Returns true if the model should be tried, false if it should be skipped.
   */
  shouldTryModel(modelName: string): boolean {
    const entry = this.cache.get(modelName);

    if (!entry) {
      // Unknown model — try it
      return true;
    }

    const now = Date.now();
    const age = now - entry.lastChecked;

    if (entry.healthy) {
      // Was healthy — trust for HEALTHY_TTL_MS
      return true;
    }

    // Was unhealthy — check if backoff has expired
    const backoff =
      entry.consecutiveFailures >= MAX_FAILURES_BEFORE_EXTENDED_BACKOFF
        ? EXTENDED_BACKOFF_MS
        : UNHEALTHY_TTL_MS;

    if (age >= backoff) {
      // Backoff expired — allow retry
      return true;
    }

    // Still in backoff period — skip this model
    return false;
  }

  /**
   * Record a successful model call.
   */
  recordSuccess(modelName: string): void {
    this.cache.set(modelName, {
      healthy: true,
      lastChecked: Date.now(),
      consecutiveFailures: 0,
    });
  }

  /**
   * Record a failed model call.
   */
  recordFailure(modelName: string): void {
    const existing = this.cache.get(modelName);
    const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;

    this.cache.set(modelName, {
      healthy: false,
      lastChecked: Date.now(),
      consecutiveFailures,
    });

    logger.debug('Model marked unhealthy', {
      model: modelName,
      consecutiveFailures,
    });
  }

  /**
   * Check if a model was recently confirmed healthy (within TTL).
   * If true, we can skip the probe entirely.
   */
  isRecentlyHealthy(modelName: string): boolean {
    const entry = this.cache.get(modelName);
    if (!entry || !entry.healthy) return false;

    const age = Date.now() - entry.lastChecked;
    return age < HEALTHY_TTL_MS;
  }

  /**
   * Get the ordered list of models to try, filtering out models in backoff.
   */
  getModelsToTry(modelsInOrder: string[]): string[] {
    return modelsInOrder.filter((model) => this.shouldTryModel(model));
  }

  /**
   * Get cache stats for debugging/monitoring.
   */
  getStats(): { total: number; healthy: number; unhealthy: number } {
    let healthy = 0;
    let unhealthy = 0;
    for (const entry of this.cache.values()) {
      if (entry.healthy) healthy++;
      else unhealthy++;
    }
    return { total: this.cache.size, healthy, unhealthy };
  }
}

// Singleton instance
export const modelHealthCache = new ModelHealthCache();
