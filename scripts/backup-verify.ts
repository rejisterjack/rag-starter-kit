/**
 * Backup Verification Script
 *
 * Verifies database backup integrity by:
 * 1. Checking that the database is reachable
 * 2. Validating schema integrity (all expected tables exist)
 * 3. Checking row counts for critical tables
 * 4. Verifying Qdrant vector store is operational
 *
 * Run: npx tsx scripts/backup-verify.ts
 *
 * For automated verification, set BACKUP_VERIFY_DB_URL to a test restore target.
 */

import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env.BACKUP_VERIFY_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL or BACKUP_VERIFY_DB_URL must be set');
  process.exit(1);
}

// Expected tables and their minimum row counts (0 means table must exist but can be empty)
const EXPECTED_TABLES: Record<string, number> = {
  users: 0,
  workspaces: 0,
  workspace_members: 0,
  documents: 0,
  document_chunks: 0,
  chats: 0,
  messages: 0,
  audit_logs: 0,
  plans: 0,
  api_usage: 0,
};

async function main() {
  const safeUrl = databaseUrl!.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log('🔍 Starting backup verification...\n');
  console.log(`   Database: ${safeUrl}\n`);

  const prisma = new PrismaClient({ accelerateUrl: databaseUrl! });

  let hasErrors = false;

  // ─── Step 1: Database connectivity ───
  console.log('1. Checking database connectivity...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✅ Database is reachable\n');
  } catch (error) {
    console.error('   ❌ Cannot connect to database:', error instanceof Error ? error.message : 'Unknown');
    process.exit(1);
  }

  // ─── Step 2: Schema integrity ───
  console.log('2. Validating schema integrity...');
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const tableNames = new Set(tables.map((t) => t.tablename));

  for (const [expectedTable] of Object.entries(EXPECTED_TABLES)) {
    if (!tableNames.has(expectedTable)) {
      console.error(`   ❌ Missing table: ${expectedTable}`);
      hasErrors = true;
    } else {
      console.log(`   ✅ Table exists: ${expectedTable}`);
    }
  }
  console.log('');

  // ─── Step 3: Row counts for critical tables ───
  console.log('3. Checking row counts...');
  for (const [table, minRows] of Object.entries(EXPECTED_TABLES)) {
    if (!tableNames.has(table)) continue;

    try {
      const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "${table}"`
      );
      const count = Number(result[0]?.count ?? 0);
      const status = count >= minRows ? '✅' : '⚠️ ';
      console.log(`   ${status} ${table}: ${count} rows (minimum: ${minRows})`);
    } catch (error) {
      console.error(`   ❌ Error counting ${table}:`, error instanceof Error ? error.message : 'Unknown');
      hasErrors = true;
    }
  }
  console.log('');

  // ─── Step 4: pgvector health ───
  console.log('4. Verifying pgvector...');
  try {
    const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    const chunks = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public.document_chunks') IS NOT NULL AS exists
    `;
    if (ext[0] && chunks[0]?.exists) {
      console.log('   ✅ pgvector extension and document_chunks table are present\n');
    } else {
      console.error('   ❌ pgvector extension or document_chunks table is missing\n');
      hasErrors = true;
    }
  } catch (error) {
    console.error('   ❌ pgvector check failed:', error instanceof Error ? error.message : 'Unknown\n');
    hasErrors = true;
  }

  // ─── Step 5: Index integrity ───
  console.log('5. Checking critical indexes...');
  try {
    const indexes = await prisma.$queryRaw<
      Array<{ indexname: string; tablename: string }>
    >`
      SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public'
    `;
    const indexNames = new Set(indexes.map((i) => i.indexname));

    const criticalIndexes = [
      'document_chunks_embedding_hnsw_idx',
      'document_chunks_documentId_idx',
      'audit_logs_createdAt_idx',
    ];

    for (const idx of criticalIndexes) {
      const status = indexNames.has(idx) ? '✅' : '⚠️ ';
      console.log(`   ${status} Index: ${idx}`);
    }
    console.log('');
  } catch (error) {
    console.error('   ⚠️  Could not verify indexes:', error instanceof Error ? error.message : 'Unknown\n');
  }

  // ─── Result ───
  if (hasErrors) {
    console.error('❌ Backup verification FAILED — some checks did not pass');
    process.exit(1);
  } else {
    console.log('✅ Backup verification PASSED — database is healthy');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
