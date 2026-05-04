import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { getAppUrl } from '@/lib/workspace/workspace';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(req: Request) {
  try {
    // Rate limit
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkApiRateLimit(identifier, 'passwordReset');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' } },
        { status: 429 }
      );
    }

    // Parse and validate
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Please provide a valid email address.' } },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Look up user — always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      // Generate reset token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in VerificationToken table
      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires: expiresAt,
        },
      });

      // Send password reset email (fire-and-forget within this scope)
      try {
        const appUrl = getAppUrl();
        const resetUrl = `${appUrl}/reset-password?token=${token}`;
        await emailService.sendEmail({
          to: email,
          template: emailService.passwordResetEmail({
            userName: user.name || email.split('@')[0],
            resetUrl,
            expiresAt,
          }),
        });
      } catch (emailError) {
        logger.error('Failed to send password reset email', {
          error: emailError instanceof Error ? emailError.message : 'Unknown',
        });
      }

      // Log audit event
      await logAuditEvent({
        event: AuditEvent.PASSWORD_RESET_REQUESTED,
        userId: user.id,
        metadata: { email },
      }).catch(() => {});
    }

    // Always return the same response regardless of whether user exists
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  } catch (error) {
    logger.error('Forgot password error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
