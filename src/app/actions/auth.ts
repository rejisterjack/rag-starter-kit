'use server';

import { headers } from 'next/headers';
import { signIn } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { registerSchema, signInSchema } from '@/lib/validation';

interface ActionResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Server Action: Sign in with credentials.
 * Validates input with Zod and calls NextAuth signIn.
 */
export async function signInWithCredentials(
  rawEmail: string,
  rawPassword: string,
  callbackUrl = '/chat'
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({ email: rawEmail, password: rawPassword, callbackUrl });
  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password format' };
  }
  const { email, password } = parsed.data;

  try {
    const reqHeaders = await headers();
    const ip =
      reqHeaders.get('x-forwarded-for')?.split(',')[0] || reqHeaders.get('x-real-ip') || 'unknown';
    const rl = await checkRateLimit(`signin:${ip}`, 'login');
    if (!rl.success) {
      return { success: false, error: 'Too many attempts. Please try again later.' };
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      return { success: false, error: 'Invalid email or password' };
    }

    return { success: true, data: { callbackUrl } };
  } catch (error) {
    logger.warn('Sign in server action failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'An error occurred. Please try again.' };
  }
}

/**
 * Server Action: Register a new user account.
 * Validates input with Zod, checks for existing user, creates account.
 */
export async function registerUser(
  rawEmail: string,
  rawPassword: string,
  rawName?: string
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
    name: rawName,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { email, password, name } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        password: hashedPassword,
      },
    });

    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    return { success: true, data: { userId: user.id } };
  } catch (error) {
    logger.warn('Register server action failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to create account. Please try again.' };
  }
}
