/**
 * CAPTCHA API Route
 *
 * Provides CAPTCHA challenges for IP-based rate limiting.
 * Supports simple math CAPTCHAs (can be extended to reCAPTCHA/hCaptcha).
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  extractClientIP,
  generateCaptchaChallenge,
  verifyCaptchaChallenge,
} from '@/lib/security/ip-rate-limiter';

/**
 * GET /api/captcha
 * Generate a new CAPTCHA challenge
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ip = extractClientIP(req);
    const challenge = await generateCaptchaChallenge(ip);

    return NextResponse.json({
      success: true,
      challengeId: challenge.challengeId,
      question: challenge.question,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate CAPTCHA',
        code: 'CAPTCHA_GENERATION_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/captcha
 * Verify a CAPTCHA response
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { challengeId, response } = body;

    if (!challengeId || !response) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing challengeId or response',
          code: 'MISSING_PARAMS',
        },
        { status: 400 }
      );
    }

    const ip = extractClientIP(req);
    const isValid = await verifyCaptchaChallenge(challengeId, response, ip);

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: 'CAPTCHA verified successfully',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid CAPTCHA response',
          code: 'INVALID_CAPTCHA',
        },
        { status: 400 }
      );
    }
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: 'CAPTCHA verification failed',
        code: 'VERIFICATION_ERROR',
      },
      { status: 500 }
    );
  }
}
