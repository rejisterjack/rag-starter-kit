import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 configuration
// - datasource.url: used by Prisma Migrate (CLI) for running migrations
// - The PrismaClient at runtime uses @prisma/adapter-pg (see src/lib/db/client.ts)
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
