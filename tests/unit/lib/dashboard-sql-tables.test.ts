import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression tests for D-11: raw SQL must reference physical table names
 * (snake_case @@map values), not Prisma model names. A PascalCase table in
 * $queryRaw causes Postgres 42P01 at runtime — invisible to mock-only tests.
 */

const servicePath = resolve(process.cwd(), 'src/lib/analytics/dashboard-service.ts');
const source = readFileSync(servicePath, 'utf-8');

// Every Prisma model -> physical table pair that raw SQL in this file may touch
const TABLE_MAP: Record<string, string> = {
  RAGEvent: 'rag_events',
  AuditLog: 'audit_logs',
  RetrievedChunk: 'retrieved_chunks',
  DocumentChunk: 'document_chunks',
  ApiUsage: 'api_usage',
  Workspace: 'workspaces',
};

describe('dashboard-service raw SQL table names (D-11)', () => {
  it('never references a Prisma model name as a quoted table', () => {
    const offenders: string[] = [];
    for (const model of Object.keys(TABLE_MAP)) {
      const pattern = new RegExp(`FROM\\s+"${model}"|JOIN\\s+"${model}"`, 'g');
      const matches = source.match(pattern);
      if (matches) offenders.push(...matches);
    }
    expect(
      offenders,
      `Raw SQL used model names instead of tables: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('uses the mapped physical table for rag_events aggregation', () => {
    expect(source).toMatch(/FROM\s+rag_events/);
  });

  it('uses the mapped physical table for audit_logs error counts', () => {
    expect(source).toMatch(/FROM\s+audit_logs/);
  });
});
