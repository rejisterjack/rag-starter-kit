/**
 * Domain Lookup API
 * 
 * Checks if an email domain is configured for SSO and returns
 * the available SSO methods for that workspace.
 */

import { NextRequest, NextResponse } from 'next/server';

import { lookupDomainCached } from '@/lib/auth/domain-routing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Lookup domain
    const result = await lookupDomainCached(email);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Domain lookup failed:', error);
    return NextResponse.json(
      { error: 'Failed to lookup domain' },
      { status: 500 }
    );
  }
}
