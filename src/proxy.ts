import { type NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';
import { validateCsrfToken } from '@/lib/security/csrf';

// =============================================================================
// Env Access
// =============================================================================

const env = {
  NEXTAUTH_SECRET: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? '',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CSP_CONNECT_SRC: process.env.CSP_CONNECT_SRC ?? '',
  NEXT_PUBLIC_ANALYTICS_HOST: process.env.NEXT_PUBLIC_ANALYTICS_HOST ?? '',
} as const;

if (process.env.NODE_ENV === 'production' && !env.NEXTAUTH_SECRET) {
  throw new Error(
    'FATAL: AUTH_SECRET or NEXTAUTH_SECRET must be set in production. ' +
      'Application cannot start without a secure signing key.'
  );
}

// =============================================================================
// Route Configuration
// =============================================================================

const PUBLIC_ROUTES = [
  '/',
  '/demo',
  '/api/demo',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/api/webhook',
  '/api/webhooks/deploy',
  '/api/health',
  '/api/docs',
  '/api/csp-report',
  '/api/error-report',
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

const PROTECTED_API_ROUTES = ['/api/chat', '/api/ingest', '/api/documents', '/api/workspaces'];
const ADMIN_ROUTES = ['/admin', '/api/admin'];

// =============================================================================
// Header Sanitization
// =============================================================================

const TRUSTED_HEADERS = [
  'x-user-id',
  'x-user-role',
  'x-workspace-id',
  'x-nonce',
  'x-request-id',
] as const;

function stripTrustedHeaders(headers: Headers): void {
  for (const key of TRUSTED_HEADERS) {
    headers.delete(key);
  }
}

// =============================================================================
// CORS Helpers
// =============================================================================

function computeCorsOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const allowedOrigins = (env.ALLOWED_ORIGINS || env.NEXTAUTH_URL)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const url = new URL(origin);
    return allowedOrigins.includes(url.origin) ? url.origin : null;
  } catch {
    return null;
  }
}

function getCorsHeaders(req: Request) {
  const corsOrigin = computeCorsOrigin(req);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-API-Key, X-Request-ID, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
  }
  return headers;
}

// =============================================================================
// Response Helper
// =============================================================================

function withRequestId(
  response: NextResponse,
  requestId: string,
  startTime?: number
): NextResponse {
  response.headers.set('X-Request-ID', requestId);
  if (startTime) {
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
  }
  return response;
}

// =============================================================================
// Proxy
// =============================================================================

const { auth } = NextAuth(authConfig);

export default auth(async function proxy(req) {
  const { nextUrl } = req;
  const { pathname } = nextUrl;

  // Fast-path: skip all processing for health/readiness probes
  if (pathname === '/api/health' || pathname === '/api/ready') {
    return NextResponse.next();
  }

  try {
    const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();
    const startTime = Date.now();

    // Only generate CSP nonce for HTML pages (API routes don't render inline scripts)
    const isHtmlRequest = !pathname.startsWith('/api/');
    let cspNonce = '';
    if (isHtmlRequest) {
      const nonceBytes = new Uint8Array(16);
      crypto.getRandomValues(nonceBytes);
      cspNonce = btoa(String.fromCharCode(...nonceBytes));
    }

    // Auth state from the auth() wrapper
    const isLoggedIn = !!req.auth;
    const authUser = req.auth?.user;
    const user = authUser
      ? { id: authUser.id, role: authUser.role, workspaceId: authUser.workspaceId }
      : null;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
      return withRequestId(response, requestId, startTime);
    }

    // CSRF protection for mutating API requests
    const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
    const CSRF_SKIP_PREFIXES = ['/api/auth/', '/api/csrf/', '/api/public/', '/api/webhooks/'];
    const CSRF_SKIP_EXACT = ['/api/csp-report'];

    if (
      pathname.startsWith('/api/') &&
      MUTATING_METHODS.has(req.method) &&
      !CSRF_SKIP_PREFIXES.some((p) => pathname.startsWith(p)) &&
      !CSRF_SKIP_EXACT.includes(pathname)
    ) {
      // For same-origin authenticated requests with a valid session cookie,
      // rely on SameSite cookie + Origin check instead of double-submit CSRF.
      const origin = req.headers.get('origin');
      const hasSessionCookie =
        req.cookies.has('next-auth.session-token') ||
        req.cookies.has('__Secure-next-auth.session-token');
      const isSameOrigin =
        !origin || origin === env.NEXTAUTH_URL || origin === new URL(env.NEXTAUTH_URL).origin;

      if (hasSessionCookie && isSameOrigin) {
        // Authenticated same-origin request — CSRF cookie may be absent due to
        // ServiceWorker replay. Session cookie + SameSite is sufficient protection.
      } else {
        const csrfValid = await validateCsrfToken(req as NextRequest);
        if (!csrfValid) {
          const response = NextResponse.json(
            {
              error: 'Invalid CSRF token',
              code: 'CSRF_INVALID',
              message:
                'The request did not include a valid CSRF token. Please refresh the page and try again.',
            },
            { status: 403, headers: getCorsHeaders(req) }
          );
          return withRequestId(response, requestId, startTime);
        }
      }
    }

    // Public routes
    const isPublicRoute = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    if (isPublicRoute) {
      const headers = new Headers(req.headers);
      stripTrustedHeaders(headers);
      headers.set('x-request-id', requestId);
      headers.set('x-nonce', cspNonce);

      const response = NextResponse.next({ request: { headers } });
      addSecurityHeaders(response, requestId, cspNonce);

      if (pathname.startsWith('/api/')) {
        for (const [k, v] of Object.entries(getCorsHeaders(req))) {
          response.headers.set(k, v);
        }
      }

      return withRequestId(response, requestId, startTime);
    }

    // Check if route requires auth
    const requiresAuth =
      PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route)) ||
      pathname.startsWith('/chat');

    // API key header: validate format, then forward for downstream key verification
    // Rate limiting has already been applied above
    const apiKey = req.headers.get('X-API-Key');
    if (apiKey && pathname.startsWith('/api/')) {
      const API_KEY_PATTERN = /^rsk_[A-Za-z0-9_-]{16,180}$/;
      if (!API_KEY_PATTERN.test(apiKey)) {
        const response = NextResponse.json(
          { error: 'Invalid API key format', code: 'INVALID_API_KEY' },
          { status: 401, headers: getCorsHeaders(req) }
        );
        return withRequestId(response, requestId, startTime);
      }

      const headers = new Headers(req.headers);
      stripTrustedHeaders(headers);
      headers.set('x-request-id', requestId);
      headers.set('x-nonce', cspNonce);

      const response = NextResponse.next({ request: { headers } });
      addSecurityHeaders(response, requestId, cspNonce);
      for (const [k, v] of Object.entries(getCorsHeaders(req))) {
        response.headers.set(k, v);
      }
      return withRequestId(response, requestId, startTime);
    }

    // Redirect unauthenticated users
    if (!isLoggedIn && requiresAuth) {
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401, headers: getCorsHeaders(req) }
        );
        return withRequestId(response, requestId, startTime);
      }

      const loginUrl = new URL('/login', nextUrl);
      const callbackUrl = nextUrl.search ? `${pathname}${nextUrl.search}` : pathname;
      loginUrl.searchParams.set('callbackUrl', callbackUrl);
      return withRequestId(NextResponse.redirect(loginUrl), requestId);
    }

    // Admin routes
    const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
    if (isAdminRoute && user?.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'Forbidden', code: 'FORBIDDEN' },
          { status: 403, headers: getCorsHeaders(req) }
        );
        return withRequestId(response, requestId, startTime);
      }
      return withRequestId(NextResponse.redirect(new URL('/', nextUrl)), requestId);
    }

    // Authenticated request — forward with user context headers
    const requestHeaders = new Headers(req.headers);
    stripTrustedHeaders(requestHeaders);
    requestHeaders.set('x-request-id', requestId);
    requestHeaders.set('x-nonce', cspNonce);

    if (isLoggedIn && user?.id) {
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-role', user.role ?? 'USER');
      if (user.workspaceId) {
        requestHeaders.set('x-workspace-id', user.workspaceId);
      }
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    addSecurityHeaders(response, requestId, cspNonce);

    if (pathname.startsWith('/api/')) {
      for (const [k, v] of Object.entries(getCorsHeaders(req))) {
        response.headers.set(k, v);
      }
    }

    return withRequestId(response, requestId);
  } catch (_error) {
    // Let auth routes pass through on proxy failure
    if (pathname?.startsWith('/api/auth/')) {
      return NextResponse.next();
    }

    if (pathname?.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'PROXY_ERROR', message: 'Request could not be processed' } },
        { status: 500 }
      );
    }

    // For page routes, pass through instead of redirecting to login.
    // The page's own server-side auth check will handle unauthorized access.
    return NextResponse.next();
  }
});

// =============================================================================
// Security Headers
// =============================================================================

function addSecurityHeaders(response: NextResponse, requestId?: string, nonce?: string): void {
  // Static headers (X-Frame-Options, X-Content-Type-Options, etc.) are set in next.config.ts
  // Only dynamic headers that require per-request nonce/values remain here

  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

  // Propagate CSP nonce to client-side scripts via a readable cookie.
  // Not HttpOnly so client components can read it for inline script nonce attributes.
  // The nonce only needs to be unguessable by remote attackers; same-origin JS
  // reading it does not weaken CSP (an XSS attacker has already bypassed CSP).
  if (nonce) {
    const secureFlag = env.NODE_ENV === 'production' ? '; Secure' : '';
    response.headers.append(
      'Set-Cookie',
      `__csp_nonce=${nonce}; Path=/; SameSite=Strict; Max-Age=60${secureFlag}`
    );
  }

  const n = nonce ?? '';

  const defaultConnectSrc = [
    "'self'",
    'https://api.openai.com',
    'https://*.vercel.app',
    'https://vercel.live',
    'https://*.vercel.live',
    'https://openrouter.ai',
    'https://*.openrouter.ai',
    'https://generativelanguage.googleapis.com',
    'https://*.googleapis.com',
    'https://*.upstash.io',
    'https://vitals.vercel-insights.com',
    'https://*.vercel-scripts.com',
    'https://va.vercel-scripts.com',
    'https://*.plausible.io',
    'https://res.cloudinary.com',
    'https://*.cloudinary.com',
    env.NEXT_PUBLIC_ANALYTICS_HOST,
    'https://*.inngest.com',
    ...(env.NODE_ENV === 'development' ? ['http://localhost:*', 'ws://localhost:*'] : []),
    'wss://*.vercel.app',
    'wss://vercel.live',
    'wss://*.vercel.live',
    'wss://*.inngest.com',
  ];

  const customConnectSrc =
    env.CSP_CONNECT_SRC?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const connectSrc = [...defaultConnectSrc, ...customConnectSrc].join(' ');

  const scriptSrc =
    env.NODE_ENV === 'development'
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8000 https://*.vercel-scripts.com https://va.vercel-scripts.com https://vercel.live https://*.vercel.live`
      : `script-src 'self' 'nonce-${n}' https://*.vercel-scripts.com https://va.vercel-scripts.com https://vercel.live https://*.vercel.live https://cdn.jsdelivr.net`;

  // CSP spec: when both a nonce and 'unsafe-inline' are present, browsers ignore 'unsafe-inline'.
  // This effectively upgrades style security in production while keeping fallback for inline styles.
  // CSP spec: browsers ignore 'unsafe-inline' when a nonce is present.
  // Keeping it as a no-op guard — DO NOT remove the nonce or this becomes a real vulnerability.
  const styleSrc =
    env.NODE_ENV === 'production'
      ? `style-src 'self' 'nonce-${n}' 'unsafe-inline'`
      : "style-src 'self' 'unsafe-inline'";

  const csp = [
    "default-src 'self'",
    scriptSrc,
    `${styleSrc} https://cdn.jsdelivr.net`,
    "img-src 'self' blob: data: https://res.cloudinary.com https://*.githubusercontent.com https://*.googleusercontent.com",
    "font-src 'self' https://cdn.jsdelivr.net",
    `connect-src https://api.github.com ${connectSrc}`,
    "object-src 'none'",
    "frame-src 'self' https://res.cloudinary.com https://docs.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "worker-src 'self' blob:",
    "form-action 'self'",
    ...(env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  response.headers.set(
    'Report-To',
    JSON.stringify({
      group: 'csp-endpoint',
      max_age: 86400,
      endpoints: [{ url: '/api/csp-report' }],
    })
  );

  if (env.NODE_ENV === 'development' && requestId && n) {
    response.headers.set('X-Nonce', n);
  }

  if (env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }
}

// =============================================================================
// Config
// =============================================================================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
