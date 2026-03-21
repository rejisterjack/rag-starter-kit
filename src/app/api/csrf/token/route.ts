/**
 * CSRF Token API Route
 * 
 * Generates and returns a new CSRF token for the client.
 * Sets the CSRF cookie and returns the token in the response.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('hex');
}

/**
 * GET /api/csrf/token
 * Generates a new CSRF token and sets the cookie
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // Generate token
    const token = generateToken();
    
    // Generate cookie value (double-submit pattern)
    const cookieValue = generateToken();
    
    // Create response
    const response = NextResponse.json({
      token,
      success: true,
    });
    
    // Set CSRF cookie
    response.cookies.set('csrf_token', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
    
    return response;
  } catch (error) {
    console.error('[CSRF] Failed to generate token:', error);
    
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
    
    // In the double-submit pattern, the token should match the cookie
    // For this implementation, we use a simple comparison
    // In production, you might use HMAC or signed tokens
    const isValid = token === cookie.value;
    
    return NextResponse.json({
      valid: isValid,
    });
  } catch (error) {
    console.error('[CSRF] Validation error:', error);
    
    return NextResponse.json(
      {
        valid: false,
        error: 'Validation failed',
      },
      { status: 500 }
    );
  }
}
