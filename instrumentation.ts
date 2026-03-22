/**
 * Next.js Instrumentation
 * Initializes Sentry and OpenTelemetry on server startup
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (err: Error, request: Request) => {
  // Report to Sentry if available
  if (process.env.SENTRY_DSN) {
    const { captureException } = await import('@sentry/nextjs');
    captureException(err, {
      contexts: {
        request: {
          url: request.url,
          method: request.method,
        },
      },
    });
  }
};
