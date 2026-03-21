import { defineConfig } from "prisma/config";

// Prisma 7 configuration
// - datasource.url: used by Prisma Migrate (CLI) for running migrations
// - The PrismaClient at runtime uses @prisma/adapter-pg (see src/lib/db/client.ts)
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/ragdb",
  },
});
