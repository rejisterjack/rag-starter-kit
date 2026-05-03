/**
 * Next.js Instrumentation
 * Initializes OpenTelemetry on server startup
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initTracing } = await import('./src/lib/tracing');
    initTracing();
  }
}
