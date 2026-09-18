import { apiError } from '@/lib/api-response';
/**
 * Domain Lookup API
 *
 * Checks if an email domain is configured for SSO and returns
 * the available SSO methods for that workspace.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { lookupDomainCached } from '@/lib/auth/domain-routing';
import { logger } from '@/lib/logger';
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return apiError('BAD_REQUEST', 'Email parameter is required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('BAD_REQUEST', 'Invalid email format', 400);
    }

    // Lookup domain
    const result = await lookupDomainCached(email);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('Failed to lookup domain', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to lookup domain', 500);
  }
}
