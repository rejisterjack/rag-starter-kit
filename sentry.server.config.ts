import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Set sample rate for profiling
  // This is relative to tracesSampleRate
  // @ts-expect-error - Sentry config option
  profilesSampleRate: 1.0,

  // Adjust sample rate in production based on traffic
  // @ts-expect-error - Sentry config option
  beforeSendTransaction(event) {
    // Skip health check transactions to reduce noise
    if (event.transaction?.includes("/api/health")) {
      return null;
    }
    return event;
  },

  // Add integrations
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    // @ts-expect-error - Sentry integration type
    Sentry.prismaIntegration(),
  ],

  // Add tags for easier filtering
  initialScope: {
    tags: {
      component: "server",
      runtime: "nodejs",
    },
  },
});
