/**
 * API Route Handler Middleware Factory
 *
 * Provides a composable middleware system for API routes with:
 * - Authentication & authorization
 * - Rate limiting
 * - CSRF protection
 * - Request validation
 * - Error handling
 *
 * Usage:
 * ```typescript
 * export const GET = createRouteHandler()
 *   .use(withAuth())
 *   .use(withRateLimit('api'))
 *   .use(withValidation(mySchema))
 *   .handle(async (req, context) => {
 *     return NextResponse.json({ data: 'success' });
 *   });
 * ```
 */

import { type NextRequest, NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import { validateCsrfToken } from '@/lib/security/csrf';
import { validate } from '@/lib/security/input-validator';
import { checkRateLimit, type RateLimitType } from '@/lib/security/rate-limiter';
import { checkPermission, type Permission } from '@/lib/workspace/permissions';

// =============================================================================
// Types
// =============================================================================

export interface RequestContext {
  userId?: string;
  userRole?: string;
  workspaceId?: string;
  permissions?: Permission[];
  [key: string]: unknown;
}

export type MiddlewareFunction = (
  req: NextRequest,
  context: RequestContext
) => Promise<NextResponse | RequestContext | null>;

export type RouteHandler = (req: NextRequest, context: RequestContext) => Promise<NextResponse>;

// =============================================================================
// Middleware Builder
// =============================================================================

class RouteHandlerBuilder {
  private middlewares: MiddlewareFunction[] = [];

  /**
   * Add a middleware to the chain
   */
  use(middleware: MiddlewareFunction): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Final handler that processes the request
   */
  handle(handler: RouteHandler): RouteHandler {
    return async (req: NextRequest, initialContext: RequestContext = {}) => {
      let context = { ...initialContext };

      // Execute middleware chain
      for (const middleware of this.middlewares) {
        try {
          const result = await middleware(req, context);

          // If middleware returns a response, short-circuit
          if (result instanceof NextResponse) {
            return result;
          }

          // If middleware returns context updates, merge them
          if (result && typeof result === 'object') {
            context = { ...context, ...result };
          }
        } catch (error) {
          logger.error('Middleware error', { error, path: req.url });
          return handleMiddlewareError(error);
        }
      }

      // Execute final handler
      try {
        return await handler(req, context);
      } catch (error) {
        logger.error('Route handler error', { error, path: req.url });
        return handleRouteError(error, context);
      }
    };
  }
}

/**
 * Create a new route handler builder
 */
export function createRouteHandler(): RouteHandlerBuilder {
  return new RouteHandlerBuilder();
}

// =============================================================================
// Built-in Middlewares
// =============================================================================

/**
 * Authentication middleware
 * Verifies user is authenticated and adds user info to context
 */
export function withAuth(): MiddlewareFunction {
  return async (req, _context) => {
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('x-api-key');

    // Check for session/token auth
    if (!authHeader && !apiKey) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Extract user info from headers (set by middleware.ts)
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');
    const workspaceId = req.headers.get('x-workspace-id');

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authentication',
          },
        },
        { status: 401 }
      );
    }

    return {
      userId,
      userRole: userRole || undefined,
      workspaceId: workspaceId || undefined,
    };
  };
}

/**
 * Authorization middleware
 * Checks if user has required permissions
 */
export function withPermission(...permissions: Permission[]): MiddlewareFunction {
  return async (_req, context) => {
    if (!context.userId || !context.workspaceId) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Permission check requires user and workspace context',
          },
        },
        { status: 403 }
      );
    }

    const hasPermission = await checkPermission(
      context.userId,
      context.workspaceId,
      permissions[0]
    );

    if (!hasPermission) {
      // Log permission denied
      await logAuditEvent({
        event: AuditEvent.PERMISSION_DENIED,
        userId: context.userId,
        workspaceId: context.workspaceId,
        metadata: {
          requiredPermissions: permissions,
        },
        severity: 'WARNING',
      });

      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        },
        { status: 403 }
      );
    }

    return null;
  };
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(type: RateLimitType): MiddlewareFunction {
  return async (req, context) => {
    const identifier =
      context.userId || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';

    const result = await checkRateLimit(identifier, type);

    if (!result.success) {
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', result.limit.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
      headers.set('Retry-After', Math.ceil((result.reset - Date.now()) / 1000).toString());

      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded. Please try again later.',
          },
        },
        { status: 429, headers }
      );
    }

    return null;
  };
}

/**
 * CSRF protection middleware
 */
export function withCsrf(): MiddlewareFunction {
  return async (req) => {
    const isValid = await validateCsrfToken(req);

    if (!isValid) {
      return NextResponse.json(
        {
          error: {
            code: 'CSRF_INVALID',
            message: 'Invalid CSRF token',
          },
        },
        { status: 403 }
      );
    }

    return null;
  };
}

/**
 * Request validation middleware
 */
export function withValidation<T>(schema: ZodSchema<T>): MiddlewareFunction {
  return async (req, _context) => {
    try {
      let data: unknown;

      if (req.method === 'GET' || req.method === 'HEAD') {
        // Parse query params for GET requests
        const url = new URL(req.url);
        data = Object.fromEntries(url.searchParams);
      } else {
        // Parse body for other methods
        data = await req.clone().json();
      }

      const result = validate(schema, data);

      if (!result.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: result.errors?.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            },
          },
          { status: 400 }
        );
      }

      // Add validated data to context
      return { validatedData: result.data };
    } catch (error: unknown) {
      logger.error('Failed to parse request body for validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_BODY',
            message: 'Failed to parse request body',
          },
        },
        { status: 400 }
      );
    }
  };
}

/**
 * Logging middleware
 */
export function withLogging(): MiddlewareFunction {
  return async (req, context) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();

    logger.debug('API request started', {
      requestId,
      method: req.method,
      path: req.url,
      userId: context.userId,
    });

    // Add request ID to context
    return { requestId, startTime: start };
  };
}

// =============================================================================
// Error Handlers
// =============================================================================

function handleMiddlewareError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message.includes('ACCOUNT_LOCKED')) {
      const timestamp = error.message.split(':')[1];
      const unlockDate = timestamp ? new Date(Number.parseInt(timestamp, 10)) : null;
      const minutes = unlockDate
        ? Math.ceil((unlockDate.getTime() - Date.now()) / (60 * 1000))
        : 15;

      return NextResponse.json(
        {
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account is locked. Please try again in ${minutes} minutes.`,
            lockedUntil: unlockDate?.toISOString(),
          },
        },
        { status: 423 }
      );
    }
  }

  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    { status: 500 }
  );
}

function handleRouteError(error: unknown, context: RequestContext): NextResponse {
  // Log the error
  logger.error('Route error', {
    error: error instanceof Error ? error.message : 'Unknown',
    userId: context.userId,
    requestId: context.requestId as string | undefined,
  });

  // Check for known error types
  if (error instanceof Error) {
    if (error.name === 'PrismaClientKnownRequestError') {
      return NextResponse.json(
        {
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database operation failed',
          },
        },
        { status: 500 }
      );
    }

    if (error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found',
          },
        },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    { status: 500 }
  );
}

// =============================================================================
// Convenience Helpers
// =============================================================================

/**
 * Create a protected route handler with common middlewares
 */
export function createProtectedRoute(
  options: { permissions?: Permission[]; rateLimit?: RateLimitType; csrf?: boolean } = {}
): RouteHandlerBuilder {
  const builder = createRouteHandler().use(withAuth());

  if (options.rateLimit) {
    builder.use(withRateLimit(options.rateLimit));
  }

  if (options.csrf) {
    builder.use(withCsrf());
  }

  if (options.permissions && options.permissions.length > 0) {
    for (const permission of options.permissions) {
      builder.use(withPermission(permission));
    }
  }

  return builder;
}

/**
 * Create a public route handler with optional rate limiting
 */
export function createPublicRoute(
  options: { rateLimit?: RateLimitType } = {}
): RouteHandlerBuilder {
  const builder = createRouteHandler();

  if (options.rateLimit) {
    builder.use(withRateLimit(options.rateLimit));
  }

  return builder;
}
