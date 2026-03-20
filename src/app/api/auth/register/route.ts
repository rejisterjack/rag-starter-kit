import { NextResponse } from 'next/server';

import { registerUser } from '@/lib/auth';
import { validateRegisterUserInput } from '@/lib/security/input-validator';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
export async function POST(req: Request) {
  try {
    // Check rate limit for registration
    const rateLimitIdentifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'register');

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT',
            message: 'Too many registration attempts. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Validate input
    let validatedInput: ReturnType<typeof validateRegisterUserInput>;
    try {
      validatedInput = validateRegisterUserInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Register user
    const result = await registerUser(validatedInput);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'REGISTRATION_FAILED', message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: result.userId,
          message: 'Account created successfully',
        },
      },
      { status: 201 }
    );
  } catch (_error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
