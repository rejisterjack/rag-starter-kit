/**
 * Error Handling Module
 *
 * Centralized error handling for the RAG Starter Kit.
 * Provides standardized error codes, messages, and React error boundaries.
 *
 * @example
 * ```typescript
 * // Using error codes in API routes
 * import { createErrorResponse, ERROR_CODES } from '@/lib/errors';
 *
 * return NextResponse.json(
 *   createErrorResponse(ERROR_CODES.AUTH_UNAUTHORIZED),
 *   { status: 401 }
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Using error boundary in components
 * import { ErrorBoundary } from '@/lib/errors';
 *
 * <ErrorBoundary componentName="Dashboard">
 *   <DashboardContent />
 * </ErrorBoundary>
 * ```
 */

// Error Boundary
export {
  APIErrorBoundary,
  ErrorBoundary,
  useErrorHandler,
} from './error-boundary';
export type { ErrorCode } from './error-codes';
// Error Codes
export {
  API_ERRORS,
  AUTH_ERRORS,
  DATABASE_ERRORS,
  DOCUMENT_ERRORS,
  ERROR_CODES,
  EXTERNAL_ERRORS,
  getErrorCategory,
  isRetryableError,
  RAG_ERRORS,
  VALIDATION_ERRORS,
} from './error-codes';

// Types
export type { ErrorMessage } from './error-messages';
// Error Messages
export {
  createErrorResponse,
  getErrorMessage,
  getErrorStatusCode,
} from './error-messages';
