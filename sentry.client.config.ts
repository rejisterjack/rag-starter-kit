import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  // @ts-expect-error - Sentry config option
  profilesSampleRate: 1.0,

  // Alternatively, use the Sentry wizard to automatically create a
  // Sentry project and configure your DSN:
  // npx @sentry/wizard@latest -i nextjs

  // Filter out certain errors
  beforeSend(event) {
    // Filter out specific errors that are not actionable
    const errorMessagesToFilter = [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ];

    if (event.exception?.values?.[0]?.value) {
      const errorMessage = event.exception.values[0].value;
      if (errorMessagesToFilter.some((msg) => errorMessage.includes(msg))) {
        return null;
      }
    }

    return event;
  },

  // Add tags for easier filtering
  initialScope: {
    tags: {
      component: "client",
    },
  },
});
