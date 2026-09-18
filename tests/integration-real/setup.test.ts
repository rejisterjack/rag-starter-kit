/**
 * Integration-real smoke tests — run against live Postgres + pgvector (CI main branch only).
 * Set RUN_INTEGRATION_REAL=true to enable.
 */

import { describe, expect, it } from 'vitest';

const enabled =
  process.env.RUN_REAL_DB_TESTS === 'true' || process.env.RUN_INTEGRATION_REAL === 'true';

describe.skipIf(!enabled)('integration-real environment', () => {
  it('has database URL configured', () => {
    expect(process.env.DATABASE_URL).toBeTruthy();
  });
});
