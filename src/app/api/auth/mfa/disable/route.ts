/**
 * MFA Disable - Requires password re-verification
 */

import { compare } from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api-response';
import { withApiAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';

const disableSchema = z.object({
  password: z.string().min(1),
});

export const POST = withApiAuth(async (req: NextRequest, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Invalid JSON', 400);
  }

  const parsed = disableSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
  }

  const { password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, mfaEnabled: true, email: true, name: true },
  });

  if (!user?.password) {
    return apiError('NOT_FOUND', 'User not found', 404);
  }

  if (!user.mfaEnabled) {
    return apiError('MFA_NOT_ENABLED', 'MFA is not enabled', 400);
  }

  const valid = await compare(password, user.password);
  if (!valid) {
    return apiError('INVALID_PASSWORD', 'Incorrect password', 401);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
      mfaVerifiedAt: null,
    },
  });

  // Send MFA disabled notification (fire-and-forget)
  try {
    await emailService.sendEmail({
      to: user.email,
      template: emailService.mfaStatusChangeEmail({
        userName: user.name || user.email,
        action: 'disabled',
        timestamp: new Date(),
      }),
    });
  } catch (emailError) {
    logger.error('Failed to send MFA disabled notification', {
      error: emailError instanceof Error ? emailError.message : 'Unknown',
    });
  }

  return apiSuccess({ message: 'MFA disabled' });
});
