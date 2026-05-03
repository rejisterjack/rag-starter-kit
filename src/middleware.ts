import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// =============================================================================
// Edge-Compatible Logger (Pino is Node.js-only and crashes Edge Runtime)
// =============================================================================

interface LogContext {
  [key: string]: unknown;
  userId?: string;
  requestId?: string;
  workspaceId?: string;
}

class EdgeLogger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private fmt(msg: string, ctx?: LogContext): string {
    const merged = { ...this.context, ...ctx, msg };
    return JSON.stringify(merged);
  }

  debug(msg: string, ctx?: LogContext): void {
    if (process.env.LOG_LEVEL === 'debug') console.debug(this.fmt(msg, ctx));
  }

  info(msg: string, ctx?: LogContext): void {
    console.info(this.fmt(msg, ctx));
  }

  warn(msg: string, ctx?: LogContext): void {
    console.warn(this.fmt(msg, ctx));
  }

  error(msg: string, ctx?: LogContext): void {
    console.error(this.fmt(msg, ctx));
  }

  child(ctx: LogContext): EdgeLogger {
    return new EdgeLogger({ ...this.context, ...ctx });
  }
}

const logger = new EdgeLogger();

// =============================================================================
// Edge-Safe Env Access (avoid importing @/lib/env which uses Zod + validates
// DATABASE_URL etc. — not all env vars are available in Edge Runtime)
// =============================================================================

const env = {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? '',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CSP_CONNECT_SRC: process.env.CSP_CONNECT_SRC ?? '',
  NEXT_PUBLIC_ANALYTICS_HOST: process.env.NEXT_PUBLIC_ANALYTICS_HOST ?? '',
} as const;

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
// Note: Chat/ingest/documents API routes are excluded because the frontend
// uses plain fetch (not form submissions). These are already protected by
// authentication, rate limiting, and CORS.
const CSRF_PROTECTED_ROUTES = ['/api/admin', '/api/export', '/api/invite'];

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

  // Generate CSP nonce early so it can be passed through request headers
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const cspNonce = btoa(String.fromCharCode(...nonceBytes));

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
    const publicHeaders = new Headers(req.headers);
    publicHeaders.set('x-request-id', requestId);
    publicHeaders.set('x-nonce', cspNonce);

    const response = NextResponse.next({
      request: { headers: publicHeaders },
    });

    // Add security headers
    addSecurityHeaders(response, requestId, cspNonce);

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
    addSecurityHeaders(response, requestId, cspNonce);
    return withRequestId(response, requestId);
  }

  // Check if route requires authentication
  // Note: Route groups like (chat) are not part of the URL path
  const requiresAuth =
    PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/chat');

  // IP-based rate limiting for unauthenticated API requests
  if (!isLoggedIn && pathname.startsWith('/api/')) {
    const { checkIPRateLimit } = await import('@/lib/security/ip-rate-limiter-edge');
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

    // For page routes, redirect to login (preserve query params in callbackUrl)
    const loginUrl = new URL('/login', nextUrl);
    const callbackUrl = nextUrl.search ? `${pathname}${nextUrl.search}` : pathname;
    loginUrl.searchParams.set('callbackUrl', callbackUrl);
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
  requestHeaders.set('x-nonce', cspNonce);

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
  addSecurityHeaders(response, requestId, cspNonce);

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

    // Web Crypto API HMAC SHA-256
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBufferRaw = await crypto.subtle.sign('HMAC', key, enc.encode(token));

    // Convert to base64url
    const base64 = btoa(String.fromCharCode(...new Uint8Array(signatureBufferRaw)));
    const expectedSignature = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Timing-safe signature comparison
    if (cookieSignature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < cookieSignature.length; i++) {
      result |= cookieSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
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

function addSecurityHeaders(response: NextResponse, requestId?: string, nonce?: string): void {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy — nonce is generated per-request in middleware
  // and passed through request headers for server components.
  const n = nonce ?? '';

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
    // Plausible for analytics (self-hosted)
    'https://*.plausible.io',
    process.env.NEXT_PUBLIC_ANALYTICS_HOST,
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

  // In development: include unsafe-inline/eval for dev tools and Plausible self-hosted
  const scriptSrc =
    env.NODE_ENV === 'development'
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8000`
      : `script-src 'self' 'nonce-${n}'`;

  // In development: omit nonce from style-src so unsafe-inline actually works
  // (browsers ignore unsafe-inline when a nonce/hash is present)
  const styleSrc =
    env.NODE_ENV === 'development'
      ? "style-src 'self' 'unsafe-inline'"
      : `style-src 'self' 'nonce-${n}'`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    `connect-src https://api.github.com ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // Expose nonce on response header as well (for debugging)
  if (requestId && n) {
    response.headers.set('X-Nonce', n);
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
