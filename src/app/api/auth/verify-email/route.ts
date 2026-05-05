/**
 * Email Verification API
 *
 * GET  /api/auth/verify-email?token=XXX  — Verify email with token from link
 * POST /api/auth/verify-email             — Resend verification email
 */

import crypto from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { emailService } from '@/lib/notifications/email';

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// ---------------------------------------------------------------------------
// GET — Verify token from email link
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const email = req.nextUrl.searchParams.get('email');

  if (!token || !email) {
    return NextResponse.redirect(new URL('/login?error=invalid-verification-link', getAppUrl()));
  }

  try {
    // Look up verification record
    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.redirect(new URL('/login?error=invalid-verification-token', getAppUrl()));
    }

    if (record.identifier !== email) {
      return NextResponse.redirect(new URL('/login?error=invalid-verification-token', getAppUrl()));
    }

    if (record.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.redirect(new URL('/login?error=verification-token-expired', getAppUrl()));
    }

    // Mark email as verified
    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    return NextResponse.redirect(new URL('/login?verified=true', getAppUrl()));
  } catch {
    return NextResponse.redirect(new URL('/login?error=verification-failed', getAppUrl()));
  }
}

// ---------------------------------------------------------------------------
// POST — Resend verification email
// ---------------------------------------------------------------------------

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId, email, name } = session.user;

  // Check if already verified
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
  }

  // Delete any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Create new token (24-hour expiry)
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const verifyUrl = `${getAppUrl()}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  await emailService.sendEmail({
    to: email,
    template: emailService.verificationEmail(name || email.split('@')[0], verifyUrl),
  });

  return NextResponse.json({ success: true, message: 'Verification email sent' });
}
