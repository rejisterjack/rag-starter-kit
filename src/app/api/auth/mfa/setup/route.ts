/**
 * MFA Setup - GET returns TOTP URI, POST verifies initial setup
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';
import {
  encryptTotpSecret,
  generateTotpSetup,
  hashBackupCodes,
  verifyTotpCode,
} from '@/lib/security/mfa';

const verifySchema = z.object({
  code: z.string().length(6),
  tempSecret: z.string(),
  backupCodes: z.array(z.string()).optional(),
});

export const GET = withApiAuth(async (_req: NextRequest, session) => {
  const user = await prismaRead.user.findUnique({
    where: { id: session.user.id },
    select: { mfaEnabled: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.mfaEnabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 });
  }

  const setup = generateTotpSetup(session.user.id, user.email);
  const encryptedSecret = encryptTotpSecret(setup.secret, session.user.id);

  return NextResponse.json({
    uri: setup.uri,
    secret: setup.secret,
    backupCodes: setup.backupCodes,
    tempSecret: encryptedSecret,
  });
});

export const POST = withApiAuth(async (req: NextRequest, session) => {
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

  const { code, tempSecret, backupCodes } = parsed.data;

  // Verify the TOTP code against the temp secret
  const valid = verifyTotpCode(code, tempSecret, session.user.id);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  // Hash backup codes for storage
  const hashedCodes = backupCodes ? await hashBackupCodes(backupCodes) : [];

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: true,
      mfaSecret: tempSecret,
      mfaBackupCodes: hashedCodes,
      mfaVerifiedAt: new Date(),
    },
  });

  // Send MFA enabled notification (fire-and-forget)
  try {
    const mfaUser = await prismaRead.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });
    if (mfaUser) {
      await emailService.sendEmail({
        to: mfaUser.email,
        template: emailService.mfaStatusChangeEmail({
          userName: mfaUser.name || mfaUser.email,
          action: 'enabled',
          timestamp: new Date(),
        }),
      });
    }
  } catch (emailError) {
    logger.error('Failed to send MFA enabled notification', {
      error: emailError instanceof Error ? emailError.message : 'Unknown',
    });
  }

  return NextResponse.json({ success: true, message: 'MFA enabled successfully' });
});
