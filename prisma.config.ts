import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 configuration for Neon
// - datasource.url: used by Prisma Migrate (CLI) for running migrations
// - The PrismaClient at runtime uses @prisma/adapter-pg (see src/lib/db/client.ts)
// `prisma generate` (postinstall) loads this file but never connects; allow it to
// run in CI and fresh clones where DATABASE_URL is not yet set.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL') ?? databaseUrl,
  },
});
