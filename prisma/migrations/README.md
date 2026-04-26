# Database Migrations

This directory contains Prisma migrations for the RAG Starter Kit database schema.

## Prerequisites

### 1. PostgreSQL with pgvector

Ensure your PostgreSQL database has the pgvector extension installed:

```sql
-- Connect to your PostgreSQL database
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search

-- Verify extensions
SELECT * FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');
```

### 2. Environment Variables

Create a `.env.local` file in the project root:

```env
# Database URLs (required)
POSTGRES_PRISMA_URL="postgres://user:password@localhost:5432/ragdb?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgres://user:password@localhost:5432/ragdb"
```

For Vercel Postgres:
```env
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
```

## Migration Workflow

### Initial Setup (First Time)

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Generate Prisma Client:**
   ```bash
   pnpm prisma generate
   ```

3. **Create Initial Migration:**
   ```bash
   pnpm prisma migrate dev --name init
   ```

4. **Run Seed Script:**
   ```bash
   pnpm prisma db seed
   ```

### Subsequent Changes

After modifying `schema.prisma`:

1. **Create migration:**
   ```bash
   pnpm prisma migrate dev --name describe_your_change
   ```

2. **Generate updated client:**
   ```bash
   pnpm prisma generate
   ```

### Production Deployment

For production/staging environments:

1. **Apply pending migrations:**
   ```bash
   pnpm prisma migrate deploy
   ```

2. **Verify deployment:**
   ```bash
   pnpm prisma migrate status
   ```

⚠️ **Warning:** Never use `prisma migrate dev` in production. Always use `prisma migrate deploy`.

## Vector Search Setup

After running migrations, create the vector similarity search index manually:

```sql
-- Connect to your database
-- Create HNSW index for efficient vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunk_embedding 
ON "document_chunks" 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Alternative: IVF flat index (better for larger datasets)
-- CREATE INDEX IF NOT EXISTS idx_document_chunk_embedding_ivf 
-- ON "document_chunks" 
-- USING ivfflat (embedding vector_cosine_ops) 
-- WITH (lists = 100);

-- Verify index
SELECT * FROM pg_indexes WHERE indexname = 'idx_document_chunk_embedding';
```

### Vector Index Options

| Index Type | Use Case | Build Time | Query Speed | Memory |
|------------|----------|------------|-------------|--------|
| HNSW | < 1M vectors | Slower | Fastest | Higher |
| IVFFlat | > 1M vectors | Faster | Fast | Lower |

## Useful Commands

```bash
# Reset database (⚠️ destroys all data)
pnpm prisma migrate reset

# View migration status
pnpm prisma migrate status

# Resolve migration issues
pnpm prisma migrate resolve --rolled-back "migration_name"

# Generate client only (no migration)
pnpm prisma generate

# Validate schema
pnpm prisma validate

# Format schema
pnpm prisma format

# Open Prisma Studio (database GUI)
pnpm prisma studio

# Pull schema from existing database
pnpm prisma db pull

# Push schema changes without migration files (dev only)
pnpm prisma db push
```

## Schema Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      User       │     │    Workspace    │     │   Document      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────┤ id (PK)         │◄────┤ id (PK)         │
│ email (unique)  │     │ name            │     │ workspaceId(FK) │
│ role            │     │ slug (unique)   │     │ name            │
│ ...             │     │ ownerId (FK)    │────►│ type            │
└─────────────────┘     │ settings (JSON) │     │ status          │
         ▲              └─────────────────┘     │ chunkCount      │
         │                       ▲              └─────────────────┘
         │                       │                       │
         │          ┌────────────┴────────────┐         │
         │          │    WorkspaceMember      │         │
         │          ├─────────────────────────┤         │
         └──────────┤ userId (FK)             │         │
                    │ workspaceId (FK)        │         │
                    │ role                    │         │
                    └─────────────────────────┘         │
                                                        ▼
                                               ┌─────────────────┐
                                               │  DocumentChunk  │
                                               ├─────────────────┤
                                               │ id (PK)         │
                                               │ documentId (FK) │
                                               │ workspaceId(FK) │
                                               │ content         │
                                               │ embedding       │◄── vector(768)
                                               └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│  Conversation   │◄────│     Message     │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ workspaceId(FK) │     │ conversationId  │
│ userId (FK)     │     │ role            │
│ title           │     │ content         │
│ settings (JSON) │     │ sources (JSON)  │
│ messageCount    │     │ tokenCount      │
└─────────────────┘     └─────────────────┘

┌─────────────────┐
│     ApiKey      │
├─────────────────┤
│ id (PK)         │
│ workspaceId(FK) │
│ name            │
│ keyHash         │
│ keyPrefix       │
│ permissions     │
└─────────────────┘
```

## Troubleshooting

### pgvector extension not found

```bash
# macOS with Homebrew
brew install pgvector

# Ubuntu/Debian
sudo apt-get install postgresql-15-pgvector

# Or use Docker
docker run -e POSTGRES_PASSWORD=password -p 5432:5432 ankane/pgvector
```

### Migration conflicts

```bash
# If migration fails, mark as rolled back
pnpm prisma migrate resolve --rolled-back "20240101000000_init"

# Or mark as applied (if manually fixed)
pnpm prisma migrate resolve --applied "20240101000000_init"
```

### Connection issues

```bash
# Test database connection
pnpm prisma db execute --stdin <<EOF
SELECT 1;
EOF
```

## Recommended package.json scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:pull": "prisma db pull",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset",
    "db:studio": "prisma studio",
    "db:validate": "prisma validate",
    "db:format": "prisma format"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```
