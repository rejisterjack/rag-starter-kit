/**
 * HTTP Tracing Middleware
 *
 * Wraps API route handlers with OpenTelemetry spans,
 * extracting request IDs and adding user/workspace context.
 */

import type { NextRequest } from 'next/server';
import { withSpan } from '@/lib/tracing';

type RouteHandler<T = unknown> = (req: NextRequest, ctx: T) => Promise<Response>;

/**
 * Wrap an API route handler with a tracing span.
 * Adds request ID, method, path, and user context as span attributes.
 */
export function withTracing<T = unknown>(
  spanName: string,
  handler: RouteHandler<T>
): RouteHandler<T> {
  return async (req, ctx) => {
    return withSpan(spanName, async (span) => {
      span.setAttribute('http.method', req.method);
      span.setAttribute('http.url', req.url);

      const requestId = req.headers.get('x-request-id');
      if (requestId) {
        span.setAttribute('request.id', requestId);
      }

      const userId = req.headers.get('x-user-id');
      if (userId) {
        span.setAttribute('user.id', userId);
      }

      const workspaceId = req.headers.get('x-workspace-id');
      if (workspaceId) {
        span.setAttribute('workspace.id', workspaceId);
      }

      try {
        const response = await handler(req, ctx);
        span.setAttribute('http.status_code', response.status);
        return response;
      } catch (error) {
        span.setAttribute('http.status_code', 500);
        throw error;
      }
    });
  };
}
