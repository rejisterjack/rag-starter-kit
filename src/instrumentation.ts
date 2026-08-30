/**
 * Next.js Instrumentation — unified server startup hooks.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { logger } from '@/lib/logger';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initObservability } = await import('@/lib/observability');
    await initObservability();

    await import('@/lib/shutdown');

    if (process.env.SENTRY_DSN) {
      try {
        await import('../sentry.server.config');
      } catch (error) {
        logger.error('Sentry initialization failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (process.env.NODE_ENV === 'production') {
      try {
        const { initTracing } = await import('@/lib/tracing');
        initTracing();
      } catch (error) {
        logger.error('Tracing initialization failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      const { validateEmbeddingDimensions } = await import('@/lib/ai/embeddings');
      const result = validateEmbeddingDimensions();
      if (result.message) {
        if (result.valid) {
          logger.warn(`Embedding validation: ${result.message}`);
        } else {
          logger.error(`Embedding validation failed: ${result.message}`);
        }
      }
    } catch (error) {
      logger.error('Embedding validation import failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    import('@/lib/ai/model-discovery')
      .then(({ refreshDiscovery }) => refreshDiscovery())
      .catch(() => {
        logger.warn('Initial model discovery failed, using hardcoded fallback');
      });

    try {
      const { initPostHogServer } = await import('@/lib/analytics/posthog');
      initPostHogServer();
    } catch (error) {
      logger.warn('PostHog server init skipped', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
