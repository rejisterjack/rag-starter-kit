import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

	// Environment
	environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,

	// Release version (auto-detected from build by default, but can be overridden)
	release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

	// Enable debug mode in development
	debug: process.env.NODE_ENV === "development",

	// Performance Monitoring - Sample rate for transactions
	// 1.0 = 100% of transactions, adjust for production
	tracesSampleRate:
		process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Session Replay Configuration
	replaysSessionSampleRate:
		process.env.NODE_ENV === "production" ? 0.1 : 1.0,
	replaysOnErrorSampleRate: 1.0, // Always sample on error

	// Integrations
	integrations: [
		// Session Replay for debugging user interactions
		Sentry.replayIntegration({
			// Mask all text content for privacy
			maskAllText: false,
			// Block all media elements
			blockAllMedia: false,
			// Network details - capture requests from same origin
			networkDetailAllowUrls: [window.location.origin],
		}),

		// Browser Profiling (if using @sentry/profiling-node)
		// Sentry.browserProfilingIntegration(),

		// Capture console errors as breadcrumbs
		Sentry.captureConsoleIntegration({
			levels: ["error", "warn"],
		}),

		// HTTP Client instrumentation
		Sentry.httpClientIntegration(),

		// Add user feedback dialog on error
		Sentry.feedbackIntegration({
			colorScheme: "system",
		}),
	],

	// Before sending events, filter out known noisy errors
	beforeSend(event) {
		// Filter out common browser extensions errors
		const errorMessage = event.exception?.values?.[0]?.value;
		if (
			errorMessage &&
			(
				errorMessage.includes("chrome-extension") ||
				errorMessage.includes("moz-extension") ||
				errorMessage.includes("ResizeObserver loop") ||
				errorMessage.includes("Loading chunk") || // webpack chunk load errors
				errorMessage.includes("document.body")
			)
		) {
			return null;
		}
		return event;
	},

	// Initial scope
	initialScope: {
		tags: {
			runtime: "browser",
		},
	},
});
