import { describe, expect, it } from 'vitest';

const runReal =
  process.env.RUN_REAL_DB_TESTS === 'true' || process.env.RUN_INTEGRATION_REAL === 'true';

describe.runIf(runReal)('public webhook ingest', () => {
  it('rejects requests without an API key', async () => {
    const { POST } = await import('@/app/api/public/ingest/route');
    const response = await POST(
      new Request('http://localhost:7392/api/public/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/docs' }),
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid JSON payloads', async () => {
    const { POST } = await import('@/app/api/public/ingest/route');
    const response = await POST(
      new Request('http://localhost:7392/api/public/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid-key',
        },
        body: 'not-json',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
