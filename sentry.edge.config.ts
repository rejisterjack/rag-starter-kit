import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Add tags for easier filtering
  initialScope: {
    tags: {
      component: "edge",
      runtime: "edge",
    },
  },
});
