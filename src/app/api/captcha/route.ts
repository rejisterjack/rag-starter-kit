import { apiError, apiSuccess } from '@/lib/api-response';
/**
 * CAPTCHA API Route
 *
 * Provides CAPTCHA challenges for IP-based rate limiting.
 * Supports simple math CAPTCHAs (can be extended to reCAPTCHA/hCaptcha).
 */

import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import {
  extractClientIP,
  generateCaptchaChallenge,
  verifyCaptchaChallenge,
} from '@/lib/security/ip-rate-limiter';

/**
 * GET /api/captcha
 * Generate a new CAPTCHA challenge
 */
export async function GET(req: NextRequest) {
  try {
    const ip = extractClientIP(req);
    const challenge = await generateCaptchaChallenge(ip);

    return apiSuccess({
      challengeId: challenge.challengeId,
      question: challenge.question,
    });
  } catch (error: unknown) {
    logger.error('Failed to generate CAPTCHA', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('CAPTCHA_GENERATION_ERROR', 'Failed to generate CAPTCHA', 500);
  }
}

/**
 * POST /api/captcha
 * Verify a CAPTCHA response
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { challengeId, response } = body;

    if (!challengeId || !response) {
      return apiError('MISSING_PARAMS', 'Missing challengeId or response', 400);
    }

    const ip = extractClientIP(req);
    const isValid = await verifyCaptchaChallenge(challengeId, response, ip);

    if (isValid) {
      return apiSuccess({ message: 'CAPTCHA verified successfully' });
    }

    return apiError('INVALID_CAPTCHA', 'Invalid CAPTCHA response', 400);
  } catch (error: unknown) {
    logger.error('CAPTCHA verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('VERIFICATION_ERROR', 'CAPTCHA verification failed', 500);
  }
}
