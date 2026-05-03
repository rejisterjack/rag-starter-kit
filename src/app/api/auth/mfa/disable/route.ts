/**
 * MFA Disable - Requires password re-verification
 */

import { compare } from 'bcryptjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withApiAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const disableSchema = z.object({
  password: z.string().min(1),
});

export const POST = withApiAuth(async (req: NextRequest, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = disableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, mfaEnabled: true },
  });

  if (!user?.password) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!user.mfaEnabled) {
    return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
  }

  const valid = await compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
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

  return NextResponse.json({ success: true, message: 'MFA disabled' });
});
