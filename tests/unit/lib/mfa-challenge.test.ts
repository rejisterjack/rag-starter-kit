import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeMfaCompletionToken,
  createMfaChallengeToken,
  createMfaCompletionToken,
  verifyMfaChallengeToken,
} from '@/lib/auth/mfa-challenge';

describe('MFA challenge tokens', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-with-enough-length-for-hmac-signing';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates and verifies challenge tokens', () => {
    const token = createMfaChallengeToken('user-123');
    const result = verifyMfaChallengeToken(token);
    expect(result?.userId).toBe('user-123');
  });

  it('creates one-time completion tokens', () => {
    const token = createMfaCompletionToken('user-456');
    expect(consumeMfaCompletionToken(token)).toBe('user-456');
  });

  it('rejects expired challenge tokens', () => {
    vi.useFakeTimers();
    const token = createMfaChallengeToken('user-789');
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(verifyMfaChallengeToken(token)).toBeNull();
  });
});
