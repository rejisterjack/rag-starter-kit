import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

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
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/chat',
  '/api/ingest',
  '/api/documents',
  '/api/workspaces',
];

// Routes that require specific roles
const ADMIN_ROUTES = ['/admin', '/api/admin'];

// CORS headers for API routes
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXTAUTH_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

// =============================================================================
// Middleware
// =============================================================================

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public routes
  if (isPublicRoute) {
    const response = NextResponse.next();
    
    // Add security headers
    addSecurityHeaders(response);
    
    // Add CORS headers for API routes
    if (pathname.startsWith('/api/')) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    
    return response;
  }

  // Check for API key authentication
  const apiKey = req.headers.get('X-API-Key');
  if (apiKey && pathname.startsWith('/api/')) {
    // API key validation will be handled by the route handler
    // We just pass through here and let the route handle it
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // Check if route requires authentication
  const requiresAuth = PROTECTED_API_ROUTES.some(
    (route) => pathname.startsWith(route)
  ) || pathname.startsWith('/chat') || pathname.startsWith('/(chat)');

  // Redirect unauthenticated users to login
  if (!isLoggedIn && requiresAuth) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401, headers: corsHeaders }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin routes
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  if (isAdminRoute && user?.role !== 'ADMIN') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403, headers: corsHeaders }
      );
    }
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  // Add user info to headers for server components
  const requestHeaders = new Headers(req.headers);
  
  if (isLoggedIn && user) {
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-role', user.role ?? 'USER');
    if (user.workspaceId) {
      requestHeaders.set('x-workspace-id', user.workspaceId);
    }
  }

  // Continue to the route
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add security headers
  addSecurityHeaders(response);

  // Add CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
});

// =============================================================================
// Security Headers
// =============================================================================

function addSecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.openai.com https://*.vercel.app",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  // HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
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
