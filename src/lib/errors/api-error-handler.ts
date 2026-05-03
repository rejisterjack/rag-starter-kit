/**
 * Global API Error Handler
 *
 * Provides centralized error handling for API routes with:
 * - Standardized error responses
 * - Automatic error logging
 * - Rate limit error handling
 * - CSRF error handling
 * - Validation error formatting
 */

import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import { ERROR_CODES, type ErrorCode } from './error-codes';

// =============================================================================
// Types
// =============================================================================

export interface APIErrorContext {
  userId?: string;
  workspaceId?: string;
  endpoint: string;
  method: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface APIErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

// =============================================================================
// Error Classes
// =============================================================================

export class APIError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }

  toJSON(): APIErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_CODES.VALIDATION_INVALID_INPUT, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(ERROR_CODES.AUTH_UNAUTHORIZED, message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message = 'Insufficient permissions') {
    super(ERROR_CODES.AUTH_FORBIDDEN, message, 403);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends APIError {
  constructor(
    message = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(ERROR_CODES.RATE_LIMIT_EXCEEDED, message, 429);
    this.name = 'RateLimitError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(ERROR_CODES.DOCUMENT_NOT_FOUND, `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

// =============================================================================
// Error Handler
// =============================================================================

/**
 * Handle API errors and return standardized response
 */
export function handleAPIError(
  error: unknown,
  context: APIErrorContext
): NextResponse<APIErrorResponse> {
  const requestId = context.requestId ?? crypto.randomUUID();

  // Handle known API errors
  if (error instanceof APIError) {
    logError(error, context, requestId);

    const headers: Record<string, string> = {
      'X-Request-ID': requestId,
    };

    // Add rate limit retry header
    if (error instanceof RateLimitError && error.retryAfter) {
      headers['Retry-After'] = String(error.retryAfter);
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.statusCode, headers }
    );
  }

  // Handle Prisma errors
  if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
    const prismaError = handlePrismaError(error, context, requestId);
    return prismaError;
  }

  // Handle Zod validation errors
  if (error instanceof Error && error.name === 'ZodError') {
    return handleZodError(error, context, requestId);
  }

  // Handle unknown errors
  return handleUnknownError(error, context, requestId);
}

/**
 * Handle Prisma database errors
 */
function handlePrismaError(
  error: Error,
  context: APIErrorContext,
  requestId: string
): NextResponse<APIErrorResponse> {
  const prismaError = error as unknown as { code: string; meta?: { target?: string[] } };

  let code: ErrorCode = ERROR_CODES.DB_ERROR;
  let message = 'Database error occurred';
  let statusCode = 500;

  switch (prismaError.code) {
    case 'P2002':
      code = ERROR_CODES.VALIDATION_DUPLICATE;
      message = `Duplicate value for: ${prismaError.meta?.target?.join(', ') || 'field'}`;
      statusCode = 409;
      break;
    case 'P2025':
      code = ERROR_CODES.DOCUMENT_NOT_FOUND;
      message = 'Record not found';
      statusCode = 404;
      break;
    case 'P2003':
      code = ERROR_CODES.VALIDATION_INVALID_INPUT;
      message = 'Foreign key constraint failed';
      statusCode = 400;
      break;
    case 'P2024':
      code = ERROR_CODES.DB_TIMEOUT;
      message = 'Database connection timeout';
      statusCode = 504;
      break;
  }

  logError(error, context, requestId, 'Database error');

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        requestId,
      },
    },
    { status: statusCode, headers: { 'X-Request-ID': requestId } }
  );
}

/**
 * Handle Zod validation errors
 */
function handleZodError(
  error: Error,
  context: APIErrorContext,
  requestId: string
): NextResponse<APIErrorResponse> {
  const zodError = error as unknown as {
    errors?: Array<{ path: (string | number)[]; message: string }>;
    issues?: Array<{ path: (string | number)[]; message: string }>;
  };

  const issues = zodError.errors || zodError.issues || [];
  const details: Record<string, string> = {};

  for (const issue of issues) {
    const path = issue.path.join('.');
    details[path] = issue.message;
  }

  logError(error, context, requestId, 'Validation error');

  return NextResponse.json(
    {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_INVALID_INPUT,
        message: 'Validation failed',
        details,
        requestId,
      },
    },
    { status: 400, headers: { 'X-Request-ID': requestId } }
  );
}

/**
 * Handle unknown/unexpected errors
 */
function handleUnknownError(
  error: unknown,
  context: APIErrorContext,
  requestId: string
): NextResponse<APIErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log the full error details
  logger.error('Unhandled API error', {
    requestId,
    endpoint: context.endpoint,
    method: context.method,
    error: errorMessage,
    stack: errorStack,
    userId: context.userId,
    workspaceId: context.workspaceId,
  });

  // Log audit event for critical errors
  logAuditEvent({
    event: AuditEvent.SUSPICIOUS_ACTIVITY,
    userId: context.userId,
    workspaceId: context.workspaceId,
    metadata: {
      endpoint: context.endpoint,
      method: context.method,
      error: errorMessage,
      requestId,
    },
    severity: 'ERROR',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  }).catch(() => {});

  return NextResponse.json(
    {
      success: false,
      error: {
        code: ERROR_CODES.API_UNKNOWN_ERROR,
        message:
          process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : errorMessage,
        requestId,
      },
    },
    { status: 500, headers: { 'X-Request-ID': requestId } }
  );
}

/**
 * Log error with context
 */
function logError(
  error: Error,
  context: APIErrorContext,
  requestId: string,
  category = 'API error'
): void {
  logger.error(category, {
    requestId,
    endpoint: context.endpoint,
    method: context.method,
    error: error.message,
    userId: context.userId,
    workspaceId: context.workspaceId,
  });
}

// =============================================================================
// Async Handler Wrapper
// =============================================================================

/**
 * Wrap async API route handlers with automatic error handling
 *
 * @example
 * ```typescript
 * import { withErrorHandler } from '@/lib/errors/api-error-handler';
 *
 * export const GET = withErrorHandler(async (request, context) => {
 *   const data = await fetchData();
 *   return NextResponse.json({ success: true, data });
 * }, { endpoint: '/api/data' });
 * ```
 */
export function withErrorHandler<T = unknown>(
  handler: (request: Request, context: T) => Promise<NextResponse>,
  options: Partial<APIErrorContext> = {}
) {
  return async (request: Request, routeContext: T): Promise<NextResponse> => {
    try {
      return await handler(request, routeContext);
    } catch (error) {
      const url = new URL(request.url);
      const context: APIErrorContext = {
        endpoint: url.pathname,
        method: request.method,
        requestId: request.headers.get('X-Request-ID') || crypto.randomUUID(),
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
        ...options,
      };

      return handleAPIError(error, context);
    }
  };
}

// =============================================================================
// Re-exports
// =============================================================================

export { createErrorResponse, getErrorMessage, getErrorStatusCode } from './error-messages';
export { ERROR_CODES };
