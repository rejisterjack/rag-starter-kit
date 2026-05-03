/**
 * Next.js Instrumentation
 * Initializes OpenTelemetry on server startup
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initTracing } = await import('./src/lib/tracing');
      initTracing();
    } catch (error) {
      console.error('Instrumentation failed:', error instanceof Error ? error.message : String(error));
    }
  }
}
