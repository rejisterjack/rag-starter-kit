import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '@/lib/api-client';

// The fetch used by apiClient — stub it per-test
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  };
}

describe('apiFetch envelope unwrapping (D-4/D-16/D-17/D-18 root cause)', () => {
  it('returns the inner data payload from a success envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { jobs: [{ id: 'j1' }] } })
    );

    const result = await apiFetch<{ jobs: Array<{ id: string }> }>('/api/admin/jobs');

    expect(result).toEqual({ jobs: [{ id: 'j1' }] });
    expect(result.jobs).toBeDefined();
  });

  it('throws ApiError with code and status for error envelopes', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403)
    );

    await expect(apiFetch('/api/admin/jobs')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
      message: 'Access denied',
    });
  });

  it('passes through non-enveloped payloads (auth-style responses)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ mfaRequired: false }));

    const result = await apiFetch<{ mfaRequired: boolean }>('/api/auth/mfa/challenge');

    expect(result).toEqual({ mfaRequired: false });
  });

  it('preserves nested items arrays used by /api/chats consumers', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { items: [{ id: 'c1' }, { id: 'c2' }], pagination: { hasMore: false } },
      })
    );

    const result = await apiFetch<{ items: string[]; pagination: unknown }>('/api/chats');

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('exposes ApiError as an Error subclass', () => {
    const err = new ApiError('boom', 500, 'INTERNAL');

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(500);
    expect(err.code).toBe('INTERNAL');
  });
});
