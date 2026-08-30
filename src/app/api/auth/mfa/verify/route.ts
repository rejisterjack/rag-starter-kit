/**
 * MFA Verify - Verifies TOTP/backup code using an MFA challenge token (no session required).
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { createMfaCompletionToken, verifyMfaChallengeToken } from '@/lib/auth/mfa-challenge';
import { prisma } from '@/lib/db';
import { removeUsedBackupCode, verifyBackupCode, verifyTotpCode } from '@/lib/security/mfa';
import { withIpRateLimit } from '@/lib/security/with-ip-rate-limit';

const verifySchema = z.object({
  code: z.string().min(6).max(8),
  challengeToken: z.string().min(1),
});

async function handler(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Invalid JSON', 400);
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
  }

  const { code, challengeToken } = parsed.data;

  const challenge = verifyMfaChallengeToken(challengeToken);
  if (!challenge) {
    return apiError('INVALID_CHALLENGE', 'Invalid or expired MFA challenge', 401);
  }

  const userId = challenge.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
  });

  if (!user?.mfaEnabled || !user.mfaSecret) {
    return apiError('MFA_NOT_CONFIGURED', 'MFA not configured', 400);
  }

  // Try TOTP code first
  const totpValid = verifyTotpCode(code, user.mfaSecret, userId);
  if (totpValid) {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaVerifiedAt: new Date() },
    });
    const completionToken = createMfaCompletionToken(userId);
    await logAuditEvent({
      event: AuditEvent.USER_LOGIN,
      userId,
      metadata: { method: 'credentials', mfa: true, step: 'totp' },
    });
    return apiSuccess({ completionToken });
  }

  // Try backup code
  const backupIndex = await verifyBackupCode(code, user.mfaBackupCodes);
  if (backupIndex >= 0) {
    const updatedCodes = removeUsedBackupCode(user.mfaBackupCodes, backupIndex);
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: updatedCodes,
        mfaVerifiedAt: new Date(),
      },
    });
    const completionToken = createMfaCompletionToken(userId);
    await logAuditEvent({
      event: AuditEvent.USER_LOGIN,
      userId,
      metadata: { method: 'credentials', mfa: true, step: 'backup' },
    });
    return apiSuccess({
      completionToken,
      warning: `Backup code used. ${updatedCodes.length} remaining.`,
    });
  }

  return apiError('INVALID_CODE', 'Invalid code', 400);
}

export const POST = withIpRateLimit(handler);
