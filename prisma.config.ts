import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 configuration for Neon
// - datasource.url: used by Prisma Migrate (CLI) for running migrations
// - The PrismaClient at runtime uses @prisma/adapter-pg (see src/lib/db/client.ts)
// NOTE: do not use `env()` from 'prisma/config' here — it throws when the
// variable is unset, which breaks `prisma generate` during postinstall in CI
// and fresh clones where DATABASE_URL is not configured yet.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
