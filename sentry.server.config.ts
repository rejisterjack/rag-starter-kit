/**
 * Sentry Server Configuration
 * Error tracking for server-side code
 */

import * as Sentry from '@sentry/nextjs';
import { initTracing } from './src/lib/tracing';

// Initialize OpenTelemetry tracing
initTracing();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    
    // Performance monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Enable profiling (requires @sentry/profiling-node)
    profilesSampleRate: process.env.SENTRY_PROFILING_ENABLED === 'true' ? 0.1 : 0,

    // Capture more context
    attachStacktrace: true,
    
    beforeSend(event) {
      // Sanitize sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      
      // Filter out health check requests
      if (event.request?.url?.includes('/api/health')) {
        return null;
      }
      
      return event;
    },
  });

  console.log('Sentry server initialized');
}
