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
	// Lower in production to manage costs
	tracesSampleRate:
		process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Integrations
	integrations: [
		// Capture console errors as breadcrumbs
		Sentry.captureConsoleIntegration({
			levels: ["error", "warn"],
		}),

		// Prisma ORM integration (if using)
		// This auto-instruments Prisma queries
		// Sentry.prismaIntegration(),

		// HTTP request tracking
		Sentry.httpIntegration(),
	],

	// Server-specific options
	// Add request headers as context to events
	sendDefaultPii: false, // Don't send personally identifiable info by default

	// Before sending events
	beforeSend(event) {
		// Sanitize sensitive data
		if (event.request) {
			// Remove sensitive headers
			if (event.request.headers) {
				const sanitizedHeaders = { ...event.request.headers };
				const sensitiveHeaders = [
					"authorization",
					"cookie",
					"x-api-key",
					"x-internal-api-key",
				];
				for (const header of sensitiveHeaders) {
					if (sanitizedHeaders[header]) {
						sanitizedHeaders[header] = "[REDACTED]";
					}
				}
				event.request.headers = sanitizedHeaders;
			}
			// Remove sensitive query params
			if (event.request.query_string) {
				const url = new URL(
					event.request.url || "",
					"http://localhost",
				);
				const sensitiveParams = ["token", "password", "secret", "key"];
				for (const param of sensitiveParams) {
					if (url.searchParams.has(param)) {
						url.searchParams.set(param, "[REDACTED]");
					}
				}
				event.request.url = url.toString();
			}
		}
		return event;
	},

	// Initial scope
	initialScope: {
		tags: {
			runtime: "nodejs",
		},
	},
});
