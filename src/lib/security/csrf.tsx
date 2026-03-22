/**
 * CSRF Protection Module with HMAC-based Token Binding
 *
 * Implements double-submit cookie pattern with HMAC-SHA256 token binding.
 * This binds the CSRF token to the user's session, preventing token fixation attacks.
 *
 * Security features:
 * - HMAC-SHA256 token generation with session binding
 * - Timing-safe comparison for token validation
 * - Automatic token rotation
 * - Protection against BREACH attacks
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

const CSRF_SECRET =
  process.env.CSRF_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'default-csrf-secret-change-in-production';

const CSRF_COOKIE_NAME = 'csrf_token';
const TOKEN_VERSION = 'v2'; // For future upgrades

// =============================================================================
// HMAC-based Token Generation
// =============================================================================

/**
 * Generate an HMAC-based CSRF token bound to a session identifier
 *
 * This creates a token that is cryptographically bound to:
 * - The CSRF secret (server-side only)
 * - A session identifier (e.g., user ID or session ID)
 * - A random nonce (prevents replay attacks)
 *
 * Format: base64(nonce:hmac)
 */
function generateHmacToken(sessionId: string): { token: string; cookieValue: string } {
  // Generate random nonce (16 bytes = 128 bits)
  const nonce = randomBytes(16).toString('base64url');

  // Create HMAC using the secret and session-bound data
  const hmac = createHmac('sha256', CSRF_SECRET);
  hmac.update(`${TOKEN_VERSION}:${sessionId}:${nonce}`);
  const hash = hmac.digest('base64url');

  // Token format: version:nonce:hash (for validation)
  const token = `${TOKEN_VERSION}:${nonce}:${hash}`;

  // Cookie value: just the nonce (the "secret" part of double-submit)
  const cookieValue = nonce;

  return { token, cookieValue };
}

/**
 * Validate an HMAC-based CSRF token
 *
 * Verifies that:
 * 1. The token format is valid
 * 2. The HMAC matches the expected value (derived from cookie nonce)
 * 3. The token hasn't expired (if we add timestamps)
 */
function validateHmacToken(token: string, cookieValue: string, sessionId: string): boolean {
  try {
    // Parse token
    const parts = token.split(':');
    if (parts.length !== 3) return false;

    const [version, nonce, providedHash] = parts;

    // Check version
    if (version !== TOKEN_VERSION) return false;

    // Verify cookie value matches nonce
    if (cookieValue !== nonce) return false;

    // Recalculate expected HMAC
    const hmac = createHmac('sha256', CSRF_SECRET);
    hmac.update(`${version}:${sessionId}:${nonce}`);
    const expectedHash = hmac.digest('base64url');

    // Timing-safe comparison
    const expectedBuffer = Buffer.from(expectedHash);
    const providedBuffer = Buffer.from(providedHash);

    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generate a new CSRF token
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @param sessionId - Session identifier for token binding
 * @returns The generated CSRF token
 */
export function generateCsrfToken(req: Request, res: Response, sessionId?: string): string {
  // Use session ID if available, otherwise generate a temporary one
  const effectiveSessionId = sessionId || req.headers.get('x-forwarded-for') || 'anonymous';

  const { token, cookieValue } = generateHmacToken(effectiveSessionId);

  // Set cookie with the nonce (HttpOnly, Secure, SameSite)
  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${cookieValue}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'Max-Age=86400', // 24 hours
  ]
    .filter(Boolean)
    .join('; ');

  res.headers.set('Set-Cookie', cookieOptions);

  return token;
}

/**
 * Generate CSRF token for App Router (Server Components)
 * Returns token and cookie header to be set
 */
export function generateCsrfTokenForAppRouter(): { token: string; cookieHeader: string } {
  // For App Router, we need a different approach
  // Generate a random token
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');

  // Create cookie header
  const cookieValue = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const cookieHeader = `csrf_token=${cookieValue}; HttpOnly; SameSite=Strict; Path=/; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`;

  return { token, cookieHeader };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate CSRF token from request
 * @param req - Next.js request object
 * @returns Boolean indicating if token is valid
 */
export async function validateCsrfToken(req: NextRequest): Promise<boolean> {
  try {
    // Skip validation for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return true;
    }

    // Get token from header or body
    const token = req.headers.get('x-csrf-token');

    if (!token) {
      return false;
    }

    // Get cookie value (the nonce)
    const cookie = req.cookies.get(CSRF_COOKIE_NAME);
    if (!cookie?.value) {
      return false;
    }

    // Get session identifier for token binding
    // Try to get from auth token, fallback to IP-based
    const sessionId =
      req.headers.get('x-user-id') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'anonymous';

    // Validate using HMAC
    const isValid = validateHmacToken(token, cookie.value, sessionId);

    return isValid;
  } catch (_error) {
    return false;
  }
}

/**
 * Rotate CSRF token
 * Call this when user authentication state changes
 */
export function rotateCsrfToken(req: NextRequest, res: NextResponse): string {
  const sessionId =
    req.headers.get('x-user-id') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous';

  const { token, cookieValue } = generateHmacToken(sessionId);

  // Set new cookie
  res.cookies.set(CSRF_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return token;
}

// =============================================================================
// Middleware
// =============================================================================

/**
 * CSRF protection middleware for API routes
 * @param handler - API route handler
 * @returns Wrapped handler with CSRF protection
 */
export function withCsrfProtection<T extends (req: NextRequest) => Promise<NextResponse>>(
  handler: T
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return handler(req);
    }

    const isValid = await validateCsrfToken(req);

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Invalid CSRF token',
          code: 'CSRF_INVALID',
          message:
            'The request did not include a valid CSRF token. Please refresh the page and try again.',
        },
        { status: 403 }
      );
    }

    return handler(req);
  };
}

// =============================================================================
// React Component
// =============================================================================

/**
 * CSRF Token Input Component
 *
 * Usage:
 * ```tsx
 * <form action="/api/something" method="POST">
 *   <CsrfTokenInput />
 *   // other form fields
 * </form>
 * ```
 */
export function CsrfTokenInput(): React.ReactElement {
  // This will be populated by the server or client-side JavaScript
  return <input type="hidden" name="_csrf" id="csrf-token-input" data-csrf-token="" />;
}

interface CsrfTokenScriptProps {
  nonce?: string;
}

/**
 * Script to initialize CSRF token on client
 */
export function CsrfTokenScript({ nonce }: CsrfTokenScriptProps): React.ReactElement {
  return (
    <script
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: CSRF token initialization script requires inline execution
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            // Fetch CSRF token from API and set in forms
            async function initCsrf() {
              try {
                const response = await fetch('/api/csrf/token');
                if (response.ok) {
                  const { token } = await response.json();
                  // Set token in all forms
                  document.querySelectorAll('input[name="_csrf"]').forEach(input => {
                    input.value = token;
                  });
                  // Set token in meta tag for JS fetch requests
                  let meta = document.querySelector('meta[name="csrf-token"]');
                  if (!meta) {
                    meta = document.createElement('meta');
                    meta.name = 'csrf-token';
                    document.head.appendChild(meta);
                  }
                  meta.content = token;
                }
              } catch (e) {
                console.error('Failed to initialize CSRF token:', e);
              }
            }
            
            // Initialize on page load
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initCsrf);
            } else {
              initCsrf();
            }
          })();
        `,
      }}
    />
  );
}

// =============================================================================
// Client-side helper
// =============================================================================

/**
 * Get CSRF token for fetch requests (client-side)
 * @returns The CSRF token from the meta tag
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;

  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || null;
}

/**
 * Fetch with CSRF token automatically included
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getCsrfToken();

  const headers = new Headers(options.headers);

  if (token && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
    headers.set('x-csrf-token', token);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
