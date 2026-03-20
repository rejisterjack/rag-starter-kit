/**
 * Sentry Error Monitoring Utilities
 *
 * Centralized module for all Sentry-related functionality.
 * Use these wrappers instead of importing @sentry/nextjs directly
 * for better consistency and easier testing/mocking.
 */

import * as Sentry from "@sentry/nextjs";
import type {
	Breadcrumb,
	CaptureContext,
	SeverityLevel,
	User,
	Span,
} from "@sentry/nextjs";

// ============================================================================
// Exception Handling
// ============================================================================

/**
 * Capture an exception/error to Sentry
 *
 * @param error - The error to capture
 * @param context - Additional context (tags, extra data, user, etc.)
 * @returns The event ID or undefined if not sent
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureException(error, {
 *     tags: { section: 'checkout' },
 *     extra: { userId: user.id }
 *   });
 * }
 * ```
 */
export function captureException(
	error: unknown,
	context?: CaptureContext,
): string | undefined {
	return Sentry.captureException(error, context);
}

/**
 * Capture a message to Sentry (for non-error events)
 *
 * @param message - The message to capture
 * @param level - Severity level (fatal, error, warning, info, debug)
 * @param context - Additional context
 * @returns The event ID or undefined if not sent
 *
 * @example
 * ```ts
 * captureMessage('User reached payment limit', 'warning', {
 *   tags: { userId: user.id }
 * });
 * ```
 */
export function captureMessage(
	message: string,
	level: SeverityLevel = "info",
): string | undefined {
	return Sentry.captureMessage(message, level);
}

// ============================================================================
// User Context
// ============================================================================

/**
 * Set user context for all subsequent events
 * Call with null to clear user context (e.g., on logout)
 *
 * @param user - User object or null to clear
 *
 * @example
 * ```ts
 * // On login
 * setUser({
 *   id: user.id,
 *   email: user.email,
 *   username: user.name,
 *   segment: user.plan // custom field
 * });
 *
 * // On logout
 * setUser(null);
 * ```
 */
export function setUser(user: User | null): void {
	Sentry.setUser(user);
}

/**
 * Get the current user context
 */
export function getUser(): User | null {
	return Sentry.getCurrentScope().getUser() ?? null;
}

// ============================================================================
// Breadcrumbs
// ============================================================================

/**
 * Add a breadcrumb to the current scope
 * Breadcrumbs help trace the sequence of events leading to an error
 *
 * @param breadcrumb - Breadcrumb data
 *
 * @example
 * ```ts
 * addBreadcrumb({
 *   category: 'auth',
 *   message: 'User logged in',
 *   level: 'info',
 *   data: { method: 'oauth', provider: 'github' }
 * });
 * ```
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
	Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Add a breadcrumb with automatic timestamp
 */
export function logBreadcrumb(
	category: string,
	message: string,
	data?: Record<string, unknown>,
	level: SeverityLevel = "info",
): void {
	addBreadcrumb({
		category,
		message,
		data,
		level,
		timestamp: Date.now(),
	});
}

// ============================================================================
// Tags & Context
// ============================================================================

/**
 * Set a tag on the current scope
 * Tags are searchable in Sentry
 */
export function setTag(key: string, value: string): void {
	Sentry.setTag(key, value);
}

/**
 * Set multiple tags at once
 */
export function setTags(tags: Record<string, string>): void {
	Sentry.setTags(tags);
}

/**
 * Set extra context data (not searchable, but visible in event details)
 */
export function setExtra(key: string, value: unknown): void {
	Sentry.setExtra(key, value);
}

/**
 * Set the scope context (e.g., 'user', 'request', etc.)
 */
export function setContext(
	name: string,
	context: Record<string, unknown> | null,
): void {
	Sentry.setContext(name, context);
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Start a custom transaction/span for performance monitoring
 *
 * @param name - Transaction name
 * @param op - Operation type (e.g., 'http.request', 'db.query')
 * @param data - Additional data
 * @returns The started span
 *
 * @example
 * ```ts
 * const span = startTransaction('process-document', 'rag.process', {
 *   documentId: doc.id,
 *   documentType: doc.type
 * });
 *
 * try {
 *   await processDocument(doc);
 *   span.setStatus('ok');
 * } catch (error) {
 *   span.setStatus('error');
 *   throw error;
 * } finally {
 *   span.finish();
 * }
 * ```
 */
export function startTransaction(
	name: string,
	op: string,
	data?: Record<string, unknown>,
): Span {
	const span = Sentry.startInactiveSpan({
		name,
	op,
	});

	if (data) {
		Object.entries(data).forEach(([key, value]) => {
			span.setAttribute(key, String(value));
		});
	}

	return span;
}

/**
 * Wrap a function with performance tracking
 *
 * @param name - Transaction name
 * @param op - Operation type
 * @param fn - Function to wrap
 * @param data - Additional data
 * @returns Result of the function
 *
 * @example
 * ```ts
 * const result = await withPerformanceTracking(
 *   'generate-embedding',
 *   'ai.embedding',
 *   () => openai.embeddings.create({ input: text }),
 *   { model: 'text-embedding-3-small' }
 * );
 * ```
 */
export async function withPerformanceTracking<T>(
	name: string,
	op: string,
	fn: () => Promise<T>,
	data?: Record<string, unknown>,
): Promise<T> {
	const span = startTransaction(name, op, data);

	try {
		const result = await fn();
		span.setStatus({ code: 1 }); // ok
		return result;
	} catch (error) {
		span.setStatus({ code: 2 }); // error
		span.setAttribute("error", true);
		throw error;
	} finally {
		span.end();
	}
}

// ============================================================================
// Scope Management
// ============================================================================

/**
 * Configure the current scope for a specific context
 * Useful for temporarily adding context to a block of code
 *
 * @param callback - Function to run with modified scope
 *
 * @example
 * ```ts
 * withScope((scope) => {
 *   scope.setTag('requestId', requestId);
 *   scope.setExtra('payload', payload);
 *   await processRequest(request);
 * });
 * ```
 */
export function withScope<T>(callback: (scope: Sentry.Scope) => T): T {
	return Sentry.withScope(callback);
}

/**
 * Run code in an isolated scope
 * Similar to withScope but completely isolates the context
 */
export function withIsolationScope<T>(
	callback: (scope: Sentry.Scope) => T,
): T {
	return Sentry.withIsolationScope(callback);
}

// ============================================================================
// Last Event ID
// ============================================================================

/**
 * Get the ID of the last captured event
 * Useful for showing error reference numbers to users
 */
export function lastEventId(): string | undefined {
	return Sentry.lastEventId();
}

// ============================================================================
// Flush & Close
// ============================================================================

/**
 * Flush pending events to Sentry
 * Useful in serverless environments before function ends
 *
 * @param timeout - Maximum time to wait (ms)
 */
export async function flush(timeout = 2000): Promise<boolean> {
	return Sentry.flush(timeout);
}

/**
 * Close the Sentry client and flush remaining events
 */
export async function close(timeout = 2000): Promise<boolean> {
	return Sentry.close(timeout);
}

// ============================================================================
// Common Use Cases
// ============================================================================

/**
 * Log an error with full context for RAG operations
 */
export function logRagError(
	error: unknown,
	operation: string,
	context: {
		documentId?: string;
		query?: string;
		model?: string;
		[user: string]: unknown;
	},
): void {
	captureException(error, {
		tags: {
			operation,
			component: "rag",
		},
		extra: context,
	});
}

/**
 * Log API errors with request context
 */
export function logApiError(
	error: unknown,
	req: {
		method: string;
		path: string;
		requestId?: string;
	},
	context?: Record<string, unknown>,
): void {
	captureException(error, {
		tags: {
			api: true,
			method: req.method,
			path: req.path,
		},
		extra: {
			requestId: req.requestId,
			...context,
		},
	});
}

/**
 * Track user actions for debugging flows
 */
export function trackUserAction(
	action: string,
	data?: Record<string, unknown>,
): void {
	logBreadcrumb("user_action", action, data, "info");
}
