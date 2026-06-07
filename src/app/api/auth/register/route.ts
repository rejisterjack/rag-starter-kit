import { hash } from 'bcryptjs';
import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';
import { formatValidationErrors, validateRegisterUserInput } from '@/lib/security/input-validator';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { withIpRateLimit } from '@/lib/security/with-ip-rate-limit';
import { createDefaultWorkspace, getAppUrl } from '@/lib/workspace/workspace';

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
async function handler(req: NextRequest) {
  try {
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

    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in registration request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput: ReturnType<typeof validateRegisterUserInput>;
    try {
      validatedInput = validateRegisterUserInput(body);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = formatValidationErrors(error);
        const message = issues.map((i) => i.message).join(' ');
        return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 400 });
      }
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    const { email, password, name } = validatedInput;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: { code: 'REGISTRATION_FAILED', message: 'User already exists' } },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: name || null, emailVerified: null },
    });

    await createDefaultWorkspace(user.id, {
      name: name ? `${name}'s Workspace` : 'My Workspace',
    });

    await logAuditEvent({
      event: AuditEvent.USER_REGISTERED,
      userId: user.id,
      metadata: { email, provider: 'credentials' },
    });

    // Send email verification (fire-and-forget)
    try {
      const crypto = await import('node:crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.verificationToken.create({ data: { identifier: email, token, expires } });

      const appUrl = getAppUrl();
      const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

      await emailService.sendEmail({
        to: email,
        template: emailService.verificationEmail(name || email.split('@')[0], verifyUrl),
      });
    } catch (emailError) {
      logger.error('Failed to send verification email', {
        error: emailError instanceof Error ? emailError.message : 'Unknown',
      });
    }

    return NextResponse.json(
      { success: true, data: { message: 'Account created successfully' } },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('Failed to register user', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export const POST = withIpRateLimit(handler);
