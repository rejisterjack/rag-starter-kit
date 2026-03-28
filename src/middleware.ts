import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// =============================================================================
// Route Configuration
// =============================================================================

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/api/webhook',
  '/api/csrf',
  '/api/health',
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

// Routes that require CSRF protection
const CSRF_PROTECTED_ROUTES = [
  '/api/chat',
  '/api/ingest',
  '/api/documents',
  '/api/workspaces',
  '/api/admin',
  '/api/export',
  '/api/invite',
];

// Safe HTTP methods that don't require CSRF protection
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// API routes that require authentication
const PROTECTED_API_ROUTES = ['/api/chat', '/api/ingest', '/api/documents', '/api/workspaces'];

// Routes that require specific roles
const ADMIN_ROUTES = ['/admin', '/api/admin'];

// =============================================================================
// CORS Helpers
// =============================================================================

/**
 * Compute CORS origin dynamically per request
 * Returns the origin if it's in the allowed list, otherwise returns the first allowed origin
 */
function computeCorsOrigin(req: NextRequest): string {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? env.NEXTAUTH_URL).split(',').map((s) => s.trim());
  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

function getCorsHeaders(req: NextRequest) {
  const corsOrigin = computeCorsOrigin(req);
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Request-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// =============================================================================
// Response Helper
// =============================================================================

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('X-Request-ID', requestId);
  return response;
}

// =============================================================================
// Middleware
// =============================================================================

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const { pathname } = nextUrl;

  // Generate or propagate request ID for tracing
  const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();

  // Get token from session
  const token = await getToken({ req, secret: env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;
  const user = token ? { id: token.sub, role: token.role, workspaceId: token.workspaceId } : null;

  // Create a request-scoped logger
  const requestLogger = logger.child({
    requestId,
    userId: user?.id,
    path: pathname,
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(req);
    const response = new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
    return withRequestId(response, requestId);
  }

  // CSRF Protection for state-changing API requests
  const requiresCsrf = CSRF_PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (requiresCsrf && !SAFE_METHODS.includes(req.method)) {
    const csrfValid = await validateCsrfToken(req);
    if (!csrfValid) {
      requestLogger.warn('CSRF validation failed', { pathname });
      const corsHeaders = getCorsHeaders(req);
      const response = NextResponse.json(
        { error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
        { status: 403, headers: corsHeaders }
      );
      return withRequestId(response, requestId);
    }
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public routes
  if (isPublicRoute) {
    const response = NextResponse.next();

    // Add security headers
    addSecurityHeaders(response, requestId);

    // Add CORS headers for API routes
    if (pathname.startsWith('/api/')) {
      const corsHeaders = getCorsHeaders(req);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    return withRequestId(response, requestId);
  }

  // Check for API key authentication
  const apiKey = req.headers.get('X-API-Key');
  if (apiKey && pathname.startsWith('/api/')) {
    // API key validation will be handled by the route handler
    // We just pass through here and let the route handle it
    const response = NextResponse.next();
    addSecurityHeaders(response, requestId);
    return withRequestId(response, requestId);
  }

  // Check if route requires authentication
  // Note: Route groups like (chat) are not part of the URL path
  const requiresAuth =
    PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/chat');

  // IP-based rate limiting for unauthenticated API requests
  if (!isLoggedIn && pathname.startsWith('/api/')) {
    const { checkIPRateLimit } = await import('@/lib/security/ip-rate-limiter');
    const ipResult = await checkIPRateLimit(req);

    if (!ipResult.allowed) {
      const corsHeaders = getCorsHeaders(req);
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          requiresCaptcha: ipResult.requiresCaptcha,
          isBlocked: ipResult.isBlocked,
          resetAt: new Date(ipResult.resetTime).toISOString(),
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': Math.ceil((ipResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );

      return withRequestId(response, requestId);
    }
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && requiresAuth) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      const corsHeaders = getCorsHeaders(req);
      const response = NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401, headers: corsHeaders }
      );
      return withRequestId(response, requestId);
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
    return withRequestId(response, requestId);
  }

  // Check admin routes
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  if (isAdminRoute && user?.role !== 'ADMIN') {
    if (pathname.startsWith('/api/')) {
      const corsHeaders = getCorsHeaders(req);
      const response = NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403, headers: corsHeaders }
      );
      return withRequestId(response, requestId);
    }
    const response = NextResponse.redirect(new URL('/', nextUrl));
    return withRequestId(response, requestId);
  }

  // Add user info to headers for server components
  const requestHeaders = new Headers(req.headers);

  // Set the request ID on headers for downstream use
  requestHeaders.set('x-request-id', requestId);

  if (isLoggedIn && user) {
    requestHeaders.set('x-user-id', user.id as string);
    requestHeaders.set('x-user-role', (user.role as string) ?? 'USER');
    if (user.workspaceId) {
      requestHeaders.set('x-workspace-id', user.workspaceId as string);
    }
  }

  // Continue to the route
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add security headers
  addSecurityHeaders(response, requestId);

  // Add CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const corsHeaders = getCorsHeaders(req);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return withRequestId(response, requestId);
}

// =============================================================================
// CSRF Token Generation and Validation
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validate CSRF token from request
 * Uses double-submit cookie pattern with HMAC validation for security
 */
async function validateCsrfToken(req: NextRequest): Promise<boolean> {
  try {
    // Get token from header
    const token = req.headers.get('x-csrf-token');

    if (!token) {
      return false;
    }

    // Get cookie value (format: token.signature)
    const cookie = req.cookies.get('csrf_token');
    if (!cookie?.value) {
      return false;
    }

    // Parse cookie value
    const cookieParts = cookie.value.split('.');
    if (cookieParts.length !== 2) {
      return false;
    }

    const [cookieToken, cookieSignature] = cookieParts;

    // Verify token matches
    if (token !== cookieToken) {
      return false;
    }

    // Verify HMAC signature
    const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || '';
    if (!secret) {
      logger.error('CSRF validation failed: no secret configured');
      return false;
    }

    const expectedSignature = createHmac('sha256', secret).update(token).digest('base64url');

    // Timing-safe signature comparison
    const signatureBuffer = Buffer.from(cookieSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    logger.warn('CSRF validation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// =============================================================================
// Security Headers
// =============================================================================

function addSecurityHeaders(response: NextResponse, requestId?: string): void {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy — always generate a fresh cryptographic nonce,
  // never derive it from requestId (which can be supplied by the client via
  // X-Request-ID and would make the nonce predictable / attacker-controlled).
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = Buffer.from(nonceBytes).toString('base64');

  // Build connect-src directive with external AI providers
  // These can be extended via the CSP_CONNECT_SRC environment variable
  const defaultConnectSrc = [
    "'self'",
    'https://api.openai.com',
    'https://*.vercel.app',
    // OpenRouter for AI model access
    'https://openrouter.ai',
    'https://*.openrouter.ai',
    // Google AI / Gemini
    'https://generativelanguage.googleapis.com',
    'https://*.googleapis.com',
    // Upstash for rate limiting
    'https://*.upstash.io',
    // PostHog for analytics
    'https://*.posthog.com',
    'https://*.posthog.io',
    // Sentry for error tracking
    'https://*.sentry.io',
    // Inngest for background jobs
    'https://*.inngest.com',
    // Ollama (local development)
    'http://localhost:*',
    'ws://localhost:*',
    // WebSocket for production (Socket.io, realtime)
    'wss://*.vercel.app',
    'wss://*.inngest.com',
  ];

  // Add custom domains from environment variable
  const customConnectSrc =
    env.CSP_CONNECT_SRC?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const connectSrc = [...defaultConnectSrc, ...customConnectSrc].join(' ');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // Expose nonce for use in layout.tsx
  if (requestId) {
    response.headers.set('X-Nonce', nonce);
  }

  // HTTPS enforcement in production
  if (env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Permissions Policy - allow microphone for voice input feature
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), interest-cohort=()'
  );
}

// =============================================================================
// Config
// =============================================================================

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
