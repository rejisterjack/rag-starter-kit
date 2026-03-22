/**
 * CSRF Protection Module
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * Uses csrf-csrf package for token generation and validation.
 */

import { doubleCsrf } from 'csrf-csrf';
import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Configuration
// =============================================================================

const CSRF_SECRET =
  process.env.CSRF_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'default-csrf-secret-change-in-production';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _csrfUtilities = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  getSessionIdentifier: () => 'session',
  cookieName: 'csrf_token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => {
    // Extract token from request body or headers
    if (req.body && typeof req.body === 'object' && '_csrf' in req.body) {
      return req.body._csrf as string;
    }
    const headerToken = req.headers['x-csrf-token'];
    if (headerToken) {
      return Array.isArray(headerToken) ? headerToken[0] : headerToken;
    }
    return undefined;
  },
});

// Destructure after to avoid type issues
const { generateCsrfToken: generateToken } = _csrfUtilities;

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generate a new CSRF token
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @returns The generated CSRF token
 */
export function generateCsrfToken(req: Request, res: Response): string {
  const token = generateToken(
    req as unknown as Parameters<typeof generateToken>[0],
    res as unknown as Parameters<typeof generateToken>[1]
  );
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

    // Get cookie value
    const cookie = req.cookies.get('csrf_token');
    if (!cookie?.value) {
      return false;
    }

    // Validate token against cookie using double-submit pattern
    // The token should be derived from or match the cookie value
    const expectedToken = cookie.value;

    // Simple comparison - in production, use HMAC or similar
    const isValid = await verifyCsrfToken(token, expectedToken);

    return isValid;
  } catch (_error) {
    return false;
  }
}

/**
 * Verify CSRF token using timing-safe comparison
 */
async function verifyCsrfToken(token: string, expected: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const tokenData = encoder.encode(token);
    const expectedData = encoder.encode(expected);

    // Use SubtleCrypto for timing-safe comparison
    if (tokenData.length !== expectedData.length) {
      return false;
    }

    // Simple constant-time comparison
    let result = 0;
    for (let i = 0; i < tokenData.length; i++) {
      result |= tokenData[i] ^ expectedData[i];
    }

    return result === 0;
  } catch {
    return false;
  }
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
