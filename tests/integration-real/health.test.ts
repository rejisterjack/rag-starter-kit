import { describe, expect, it } from 'vitest';

const runReal =
  process.env.RUN_REAL_DB_TESTS === 'true' || process.env.RUN_INTEGRATION_REAL === 'true';

describe.runIf(runReal)('real infrastructure health', () => {
  it('connects to postgres', async () => {
    const { prisma } = await import('@/lib/db');
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
  });

  it('has pgvector and document_chunks', async () => {
    const { prisma } = await import('@/lib/db');
    const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    expect(ext[0]?.extname).toBe('vector');
    const table = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public.document_chunks') IS NOT NULL AS exists
    `;
    expect(table[0]?.exists).toBe(true);
  });
});
