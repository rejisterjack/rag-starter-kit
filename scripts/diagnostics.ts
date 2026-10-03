import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Redis } from '@upstash/redis';

async function testLocalPostgres(dbName: string) {
  const url = `postgresql://postgres:postgres@localhost:5432/${dbName}?sslmode=disable`;
  console.log(`\n[Prisma DB] Testing local DB: "${dbName}"...`);
  
  let pool: pg.Pool | null = null;
  let prisma: PrismaClient | null = null;
  const start = Date.now();
  
  try {
    pool = new pg.Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({
      adapter,
      log: ['error'],
    });

    const res = await prisma.$queryRaw`SELECT 1`;
    console.log(`[Prisma DB] SUCCESS for "${dbName}"! Query res:`, JSON.stringify(res));
    console.log(`[Prisma DB] Latency: ${Date.now() - start}ms`);

    const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    console.log(
      ext[0]
        ? `[Prisma DB] pgvector extension is installed`
        : `[Prisma DB] WARNING: pgvector extension not found`
    );
    
    await prisma.$disconnect();
    await pool.end();
    return true;
  } catch (err: any) {
    console.log(`[Prisma DB] FAILED for "${dbName}":`, err.message || err);
    if (prisma) {
      try { await prisma.$disconnect(); } catch {}
    }
    if (pool) {
      try { await pool.end(); } catch {}
    }
    return false;
  }
}

async function runDiagnostics() {
  console.log('--- LOCAL SERVICE DIAGNOSTICS ---');

  // 1. Check Local Redis
  console.log('\n[Redis] Testing local Redis connection at localhost:6379...');
  try {
    const localRedis = new Redis({ url: 'http://localhost:6379', token: 'mock' });
    const start = Date.now();
    const pingRes = await localRedis.ping();
    console.log(`[Redis] Local Upstash REST Success! Result: "${pingRes}". Latency: ${Date.now() - start}ms`);
  } catch (err: any) {
    console.log(`[Redis] Local Upstash REST ping failed:`, err.message || err);
  }

  // 2. Check Postgres DBs
  const dbNames = ['postgres', 'ragdb', 'rag-starter-kit', 'rsk'];
  for (const name of dbNames) {
    await testLocalPostgres(name);
  }

  console.log('\n--- Diagnostics Complete ---');
}

runDiagnostics().catch(console.error);
