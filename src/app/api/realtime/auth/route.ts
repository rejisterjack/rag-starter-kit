import { apiError } from '@/lib/api-response';
/**
 * Ably Token Authentication Endpoint
 *
 * POST /api/realtime/auth
 *
 * Generates Ably tokens for authenticated users.
 * Returns a clear error if ABLY_API_KEY is not configured.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(_req: Request): Promise<Response> {
  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    return apiError(
      'REALTIME_NOT_CONFIGURED',
      'Real-time features are not configured. Set ABLY_API_KEY to enable.',
      501
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const userId = session.user.id;

  try {
    // Lazy import — Ably is ~200KB and only needed when actually using real-time features
    const Ably = await import('ably');

    const rest = new Ably.Rest({ key: apiKey });

    const tokenParams: import('ably').TokenParams = {
      clientId: userId,
      capability: {
        'workspace:*': ['publish', 'subscribe', 'presence'],
        'chat:*': ['publish', 'subscribe', 'presence'],
        'conversation:*': ['publish', 'subscribe', 'presence'],
        [`notifications:${userId}`]: ['publish', 'subscribe'],
      },
      ttl: 3600000,
    };

    const tokenRequest = await rest.auth.createTokenRequest(tokenParams);

    return NextResponse.json(tokenRequest);
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    const message = isDev
      ? error instanceof Error
        ? error.message
        : 'Token generation failed'
      : 'Token generation failed';
    return apiError('TOKEN_ERROR', message, 500);
  }
}
