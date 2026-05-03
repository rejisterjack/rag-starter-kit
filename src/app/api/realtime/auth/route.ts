/**
 * Ably Token Authentication Endpoint
 *
 * POST /api/realtime/auth
 *
 * Generates Ably tokens for authenticated users.
 * This is required for Vercel deployment — the Ably API key is never exposed to the client.
 */

import * as Ably from 'ably';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(_req: Request): Promise<Response> {
  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Ably API key not configured' } },
      { status: 500 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  try {
    const rest = new Ably.Rest({ key: apiKey });

    const tokenParams: Ably.TokenParams = {
      clientId: userId,
      capability: {
        'workspace:*': ['publish', 'subscribe', 'presence'],
        'chat:*': ['publish', 'subscribe', 'presence'],
        'conversation:*': ['publish', 'subscribe', 'presence'],
        [`notifications:${userId}`]: ['publish', 'subscribe'],
      },
      ttl: 3600000, // 1 hour
    };

    const tokenRequest = await rest.auth.createTokenRequest(tokenParams);

    return NextResponse.json(tokenRequest);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token generation failed';
    return NextResponse.json({ error: { code: 'TOKEN_ERROR', message } }, { status: 500 });
  }
}
