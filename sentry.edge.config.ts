import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.SENTRY_DSN,

	// Environment
	environment: process.env.NODE_ENV,

	// Release version
	release: process.env.SENTRY_RELEASE,

	// Enable debug mode in development
	debug: process.env.NODE_ENV === "development",

	// Performance Monitoring - Sample rate for transactions
	tracesSampleRate:
		process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Edge runtime specific options
	// Edge runtime has limited API surface, so integrations are minimal
	integrations: [],

	// Initial scope
	initialScope: {
		tags: {
			runtime: "edge",
		},
	},
});
