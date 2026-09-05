import { PostHog } from 'posthog-node';
import { logger } from '@/lib/logger';

let posthogServer: PostHog | null = null;

export function initPostHogServer(): void {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';

  if (!apiKey) {
    return;
  }

  posthogServer = new PostHog(apiKey, { host, flushAt: 20, flushInterval: 10000 });
  logger.info('PostHog server client initialized');
}

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  posthogServer?.capture({ distinctId, event, properties });
}

export async function shutdownPostHogServer(): Promise<void> {
  if (posthogServer) {
    await posthogServer.shutdown();
    posthogServer = null;
  }
}
