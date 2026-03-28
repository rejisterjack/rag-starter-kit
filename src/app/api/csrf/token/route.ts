/**
 * CSRF Token API Route
 *
 * Generates and returns a new CSRF token for the client.
 * Sets the CSRF cookie and returns the token in the response.
 *
 * SECURITY: Uses HMAC-SHA256 to sign tokens, preventing forgery even if
 * an attacker can set cookies (e.g., via subdomain takeover).
 */

import { createHmac } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Get the CSRF signing secret
 * Uses CSRF_SECRET if available, otherwise falls back to NEXTAUTH_SECRET
 */
function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('CSRF_SECRET or NEXTAUTH_SECRET must be configured');
  }
  return secret;
}

/**
 * Generate a cryptographically secure random token with HMAC signature
 *
 * SECURITY: The token is signed with a server-side secret to prevent forgery.
 * Format: token.signature (both base64url encoded)
 */
function generateSignedToken(): { token: string; signature: string; combined: string } {
  const secret = getCsrfSecret();

  // Generate random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Buffer.from(array).toString('base64url');

  // Generate HMAC signature
  const signature = createHmac('sha256', secret).update(token).digest('base64url');

  // Combined format for cookie
  const combined = `${token}.${signature}`;

  return { token, signature, combined };
}

/**
 * GET /api/csrf/token
 * Generates a new CSRF token and sets the cookie
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // Generate signed token
    // The double-submit pattern requires the header value the client sends
    // to match the token portion of the cookie value — the signature is verified server-side.
    const { token, combined } = generateSignedToken();

    const response = NextResponse.json({
      token,
      success: true,
    });

    // Set the cookie to the combined value (token.signature)
    // The client reads the token and sends it in the header
    // The middleware verifies the signature using the server secret
    response.cookies.set('csrf_token', combined, {
      httpOnly: false, // must be readable by JS so the client can copy it to a header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (_error) {
    return NextResponse.json(
      {
        error: 'Failed to generate CSRF token',
        code: 'CSRF_GENERATION_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/csrf/token
 * Validates a CSRF token (for testing/debugging)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Missing token',
        },
        { status: 400 }
      );
    }

    // Get cookie
    const cookie = req.cookies.get('csrf_token');

    if (!cookie?.value) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Missing CSRF cookie',
        },
        { status: 400 }
      );
    }

    // Parse cookie value (format: token.signature)
    const cookieParts = cookie.value.split('.');
    if (cookieParts.length !== 2) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid cookie format',
        },
        { status: 400 }
      );
    }

    const [cookieToken, cookieSignature] = cookieParts;

    // Verify token matches
    if (token !== cookieToken) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Token mismatch',
        },
        { status: 400 }
      );
    }

    // Verify HMAC signature
    const secret = getCsrfSecret();
    const expectedSignature = createHmac('sha256', secret).update(token).digest('base64url');

    // Use timing-safe comparison
    const sigBuf = Buffer.from(cookieSignature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid signature length',
        },
        { status: 400 }
      );
    }

    const isValid = require('node:crypto').timingSafeEqual(sigBuf, expectedBuf);

    return NextResponse.json({
      valid: isValid,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        valid: false,
        error: 'Validation failed',
      },
      { status: 500 }
    );
  }
}
