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

// Error Codes
export {
  ERROR_CODES,
  AUTH_ERRORS,
  VALIDATION_ERRORS,
  API_ERRORS,
  RAG_ERRORS,
  DOCUMENT_ERRORS,
  DATABASE_ERRORS,
  EXTERNAL_ERRORS,
  getErrorCategory,
  isRetryableError,
} from './error-codes';

// Error Messages
export {
  getErrorMessage,
  createErrorResponse,
  getErrorStatusCode,
} from './error-messages';

// Error Boundary
export {
  ErrorBoundary,
  APIErrorBoundary,
  useErrorHandler,
} from './error-boundary';

// Types
export type { ErrorMessage } from './error-messages';
export type { ErrorCode } from './error-codes';
