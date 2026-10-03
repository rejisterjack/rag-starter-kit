import crypto from 'node:crypto';

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MFA_COMPLETION_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is required for MFA challenge tokens');
  }
  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
}

function encodeToken(
  kind: 'challenge' | 'completion',
  userId: string,
  nonce: string,
  exp: number
): string {
  const payload = `${kind}:${userId}:${nonce}:${exp}`;
  const signature = signPayload(payload);
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

function decodeAndVerifyToken(
  token: string,
  expectedKind: 'challenge' | 'completion'
): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;

    const [kind, userId, , expStr, signature] = parts;
    if (kind !== expectedKind || !userId || !expStr || !signature) return null;

    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;

    const payload = `${kind}:${userId}:${parts[2]}:${expStr}`;
    const expected = signPayload(payload);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    return { userId };
  } catch {
    return null;
  }
}

/** Issue a short-lived MFA challenge after password verification. */
export function createMfaChallengeToken(userId: string): string {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const exp = Date.now() + MFA_CHALLENGE_TTL_MS;
  return encodeToken('challenge', userId, nonce, exp);
}

export function verifyMfaChallengeToken(token: string): { userId: string } | null {
  return decodeAndVerifyToken(token, 'challenge');
}

/** One-time token issued after successful TOTP/backup verification. */
export function createMfaCompletionToken(userId: string): string {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const exp = Date.now() + MFA_COMPLETION_TTL_MS;
  return encodeToken('completion', userId, nonce, exp);
}

export function consumeMfaCompletionToken(token: string): string | null {
  const result = decodeAndVerifyToken(token, 'completion');
  return result?.userId ?? null;
}

export function parseMfaRequiredError(error: string | undefined): string | null {
  if (!error) return null;
  if (error.startsWith('MFA_REQUIRED:')) {
    return error.slice('MFA_REQUIRED:'.length);
  }
  return null;
}
