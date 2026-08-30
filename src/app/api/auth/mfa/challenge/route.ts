/**
 * POST /api/auth/mfa/challenge
 * Validates email/password and returns an MFA challenge token when MFA is enabled.
 */

import { compare } from 'bcryptjs';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api-response';
import { createMfaChallengeToken } from '@/lib/auth/mfa-challenge';
import { prisma } from '@/lib/db';
import {
  getLockoutStatus,
  recordFailedAttempt,
  recordSuccessfulLogin,
} from '@/lib/security/account-lockout';
import { withIpRateLimit } from '@/lib/security/with-ip-rate-limit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function handler(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_JSON', 'Invalid JSON', 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
  }

  const { email, password } = parsed.data;
  const lockoutStatus = await getLockoutStatus(email);
  if (lockoutStatus.isLocked) {
    return apiError('ACCOUNT_LOCKED', 'Account locked', 423);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true, mfaEnabled: true },
  });

  if (!user?.password) {
    await recordFailedAttempt(email);
    return apiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
  }

  const isValid = await compare(password, user.password);
  if (!isValid) {
    await recordFailedAttempt(email);
    return apiError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
  }

  await recordSuccessfulLogin(email);

  if (!user.mfaEnabled) {
    return apiSuccess({ mfaRequired: false });
  }

  return apiSuccess({
    mfaRequired: true,
    challengeToken: createMfaChallengeToken(user.id),
  });
}

export const POST = withIpRateLimit(handler);
