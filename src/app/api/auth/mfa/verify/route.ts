/**
 * MFA Verify - Verifies TOTP code during login when MFA is required
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { removeUsedBackupCode, verifyBackupCode, verifyTotpCode } from '@/lib/security/mfa';
import { withIpRateLimit } from '@/lib/security/with-ip-rate-limit';

const verifySchema = z.object({
  code: z.string().min(6).max(8),
  userId: z.string(),
});

async function handler(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { code, userId } = parsed.data;

  // Verify the requesting user is authenticated and matches the userId in the body
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (userId !== session.user.id) {
    return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
  });

  if (!user?.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: 'MFA not configured' }, { status: 400 });
  }

  // Try TOTP code first
  const totpValid = verifyTotpCode(code, user.mfaSecret, userId);
  if (totpValid) {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaVerifiedAt: new Date() },
    });
    return NextResponse.json({ success: true });
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
    return NextResponse.json({
      success: true,
      warning: `Backup code used. ${updatedCodes.length} remaining.`,
    });
  }

  return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
}

export const POST = withIpRateLimit(handler);
