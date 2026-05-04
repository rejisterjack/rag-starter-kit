import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';
import { revokeAllUserSessions } from '@/lib/security/session-store';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(' ');
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 400 });
    }

    const { token, password } = parsed.data;

    // Find the reset token
    const resetToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token.' } },
        { status: 400 }
      );
    }

    // Find user by email (stored as identifier)
    const user = await prisma.user.findUnique({
      where: { email: resetToken.identifier },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'USER_NOT_FOUND', message: 'User not found.' } },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hash(password, 12);

    // Update password and delete token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.verificationToken.delete({
        where: { token },
      }),
    ]);

    // Revoke all existing sessions
    await revokeAllUserSessions(user.id);

    // Log audit event
    await logAuditEvent({
      event: AuditEvent.PASSWORD_CHANGED,
      userId: user.id,
      metadata: { method: 'reset' },
    });

    // Send password change notification (fire-and-forget)
    try {
      await emailService.sendEmail({
        to: user.email,
        template: emailService.passwordChangedNotificationEmail({
          userName: user.name || user.email,
          changedAt: new Date(),
        }),
      });
    } catch (emailError) {
      logger.error('Failed to send password reset notification', {
        error: emailError instanceof Error ? emailError.message : 'Unknown',
      });
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    logger.error('Reset password error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
