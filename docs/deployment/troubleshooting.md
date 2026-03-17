# Deployment Troubleshooting Guide

This guide covers common deployment issues and their solutions.

## Table of Contents

1. [Database Issues](#database-issues)
2. [Build Failures](#build-failures)
3. [Runtime Errors](#runtime-errors)
4. [Performance Issues](#performance-issues)
5. [Rollback Procedures](#rollback-procedures)

---

## Database Issues

### Migration Failures

**Symptom**: `prisma migrate deploy` fails

**Common Causes & Solutions**:

```bash
# 1. Check database connectivity
npx prisma db ping

# 2. Verify connection string format
# Should be: postgres://user:pass@host:5432/db?pgbouncer=true&connect_timeout=15

# 3. Check if database exists and is accessible
npx prisma db execute --stdin <<< "SELECT 1"

# 4. Run with verbose output for debugging
npx prisma migrate deploy --preview-feature
```

**Error: `P1001: Can't reach database server`**

- Check if database server is running
- Verify firewall rules allow connections
- Check VPC/security group settings
- Ensure connection string is correct

**Error: `P3005: Database schema is not empty`**

```bash
# Baseline existing database (use with caution!)
npx prisma migrate resolve --applied INITIAL_MIGRATION_NAME
```

### pgvector Extension Issues

**Symptom**: Vector search not working

```bash
# Check if extension is installed
npx prisma db execute --stdin <<< "SELECT * FROM pg_extension WHERE extname = 'vector'"

# Install extension if missing
npx prisma db execute --stdin <<< "CREATE EXTENSION IF NOT EXISTS vector"
```

**Error: `extension "vector" is not available`**

- Ensure using PostgreSQL 14+ with pgvector
- Check if pgvector is installed on the server
- For managed databases (AWS RDS, etc.), enable the extension in console

---

## Build Failures

### Environment Variable Errors

**Symptom**: `process.env.XYZ is undefined` during build

**Solutions**:

1. **Add env vars to Vercel dashboard**
   ```
   Project Settings → Environment Variables
   ```

2. **For local builds, create .env.production**:
   ```bash
   cp .env.production.example .env.production
   # Edit with your production values
   ```

3. **Use dummy values for build-time only**:
   ```yaml
   # In CI workflow
   env:
     POSTGRES_PRISMA_URL: "postgres://dummy@localhost/dummy"
   ```

### Prisma Client Generation

**Symptom**: `Cannot find module '@prisma/client'`

```bash
# Regenerate client
npx prisma generate

# Ensure postinstall hook runs
pnpm install
```

**Error: `Binary target not supported`**

Add to `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

### Memory Issues During Build

**Symptom**: Build fails with `JavaScript heap out of memory`

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

**Vercel Specific**:
```json
// vercel.json
{
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096"
    }
  }
}
```

---

## Runtime Errors

### 500 Internal Server Errors

**Check server logs**:
```bash
# Vercel logs
vercel logs --all

# Or check Functions tab in Vercel dashboard
```

**Common Issues**:

1. **Missing Environment Variables**
   - Check Vercel Environment Variables
   - Verify variables are added to Production environment
   - Redeploy after adding variables

2. **Database Connection Pool Exhaustion**
   ```typescript
   // Check if you're closing connections properly
   await prisma.$disconnect();
   ```

3. **Cold Start Timeouts**
   - Increase function timeout in `vercel.json`
   - Consider using Edge Runtime for API routes

### Authentication Issues

**Symptom**: Users can't log in

**Checklist**:
- [ ] `NEXTAUTH_SECRET` is set and consistent
- [ ] `NEXTAUTH_URL` matches your domain
- [ ] OAuth credentials are correct
- [ ] Callback URLs are configured in OAuth providers

**Debug NextAuth**:
```typescript
// .env.production
DEBUG="next-auth:*"
```

### API Rate Limiting

**Symptom**: `429 Too Many Requests`

```typescript
// Check rate limit configuration
// src/lib/security/rate-limiter.ts

// Increase limits if needed
const RATE_LIMITS = {
  default: { requests: 100, window: 60 }, // 100 req/min
  upload: { requests: 10, window: 60 },    // 10 uploads/min
};
```

---

## Performance Issues

### Slow API Responses

**Debugging**:

```bash
# Add performance logging
DEBUG="prisma:*" pnpm dev
```

**Database Query Optimization**:

1. **Add indexes**:
   ```sql
   CREATE INDEX CONCURRENTLY idx_documents_user_id ON documents(user_id);
   CREATE INDEX CONCURRENTLY idx_chats_workspace_id ON chats(workspace_id);
   ```

2. **Optimize vector search**:
   ```sql
   -- Add IVFFlat index for vector search
   CREATE INDEX CONCURRENTLY ON document_chunks 
   USING ivfflat (embedding vector_cosine_ops) 
   WITH (lists = 100);
   ```

### High Memory Usage

**Memory Leaks**:

```typescript
// Ensure proper cleanup in API routes
export async function POST(req: Request) {
  try {
    // ... your code
  } finally {
    await prisma.$disconnect();
  }
}
```

**Large Document Processing**:
- Implement chunked processing
- Use background jobs (Inngest)
- Add file size limits

---

## Rollback Procedures

### Vercel Deployment Rollback

**Immediate Rollback**:
```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]

# Or use dashboard:
# Deployments → [Failed Deploy] → ... → Promote to Production
```

### Database Rollback

**If migration causes issues**:

```bash
# 1. Stop the application (set maintenance mode)

# 2. Restore from backup
pg_dump -Fc database_backup.sql | psql $DATABASE_URL

# 3. Or revert specific migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

**Emergency Database Access**:
```bash
# Connect to production database
psql $DATABASE_URL

# Check current migrations
SELECT * FROM _prisma_migrations ORDER BY started_at DESC;
```

### Code Rollback

```bash
# Revert to last known good commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard COMMIT_HASH
git push origin main --force
```

---

## Common Error Messages

### `ENOENT: no such file or directory`

**Cause**: Missing files in build output

**Solution**:
```javascript
// next.config.js
module.exports = {
  output: 'standalone',
  // Ensure all required files are included
}
```

### `Module not found: Can't resolve 'fs'`

**Cause**: Trying to use Node.js modules in Edge Runtime

**Solution**:
```typescript
// Use Node.js runtime for file system operations
export const runtime = 'nodejs'; // not 'edge'
```

### `Failed to fetch` / Network Errors

**CORS Issues**:
```typescript
// middleware.ts or next.config.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

---

## Getting Help

If issues persist:

1. **Check logs thoroughly**
   - Vercel Function Logs
   - Sentry error reports
   - Database logs

2. **Enable debug mode**
   ```bash
   DEBUG="*" pnpm dev
   ```

3. **Create minimal reproduction**
   - Strip down to minimal code
   - Test locally with production env vars

4. **Community Resources**
   - [Next.js Discussions](https://github.com/vercel/next.js/discussions)
   - [Prisma Slack](https://slack.prisma.io/)
   - [Vercel Support](https://vercel.com/help)

5. **Emergency Contact**
   - File an issue with [URGENT] prefix
   - Include deployment URL and error logs
