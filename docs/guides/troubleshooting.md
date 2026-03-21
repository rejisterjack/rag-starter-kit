# Troubleshooting Guide

Common issues and solutions for the RAG Starter Kit.

## Quick Diagnostics

### Health Check

```bash
# Check application health
curl http://localhost:3000/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "database": { "healthy": true, "latency": 5 },
    "redis": { "healthy": true, "latency": 2 },
    "storage": { "healthy": true }
  }
}
```

### System Status

```bash
# Check Docker containers
docker-compose ps

# View logs
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis

# Check resource usage
docker stats
```

## Installation Issues

### pnpm Not Found

```bash
# Install pnpm globally
npm install -g pnpm

# Or use corepack
corepack enable
corepack prepare pnpm@latest --activate
```

### Node Version Mismatch

```bash
# Check Node version
node --version  # Should be 20.x

# Use nvm to switch versions
nvm install 20
nvm use 20

# Or use n
npm install -g n
n 20
```

### Dependencies Installation Fails

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm store prune
pnpm install

# If still failing, check network
pnpm install --registry https://registry.npmjs.org
```

## Database Issues

### Connection Refused

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Start if not running
docker-compose up -d postgres

# Check logs
docker-compose logs postgres

# Verify connection string format
# postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

### Migration Failures

```bash
# Reset database (WARNING: deletes all data!)
docker-compose down -v postgres
docker-compose up -d postgres
pnpm db:migrate

# Or mark migration as applied
pnpm prisma migrate resolve --applied "migration_name"

# Check migration status
pnpm prisma migrate status
```

### pgvector Extension Missing

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d rag_starter_kit

# Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
\dx
```

### Prisma Client Issues

```bash
# Regenerate client
pnpm db:generate

# If types are outdated
rm -rf node_modules/.pnpm/@prisma+client*
pnpm install
pnpm db:generate
```

## AI/LLM Issues

### OpenRouter Errors

```bash
# Test API key
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/auth/key

# Check rate limits
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models
```

**Error: "Invalid API Key"**
- Verify key format: `sk-or-v1-...`
- Check environment variable is set: `echo $OPENROUTER_API_KEY`
- Ensure no extra spaces in .env file

**Error: "Rate limit exceeded"**
- Free tier has rate limits
- Implement exponential backoff in client
- Consider upgrading to paid tier

### Google Gemini Errors

```bash
# Test API key
curl "https://generativelanguage.googleapis.com/v1/models?key=$GOOGLE_API_KEY"
```

**Error: "API key not valid"**
- Verify key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Check billing is enabled
- Ensure API is not rate limited

### Embedding Generation Slow

```bash
# Check batch size
# Default is 100, can be adjusted in src/lib/ai/embeddings/google.ts

# Monitor API latency
pnpm vitest run tests/performance/embeddings.test.ts
```

## Authentication Issues

### NextAuth Errors

**Error: "JWT must have 3 parts"**
```bash
# Generate new secret
openssl rand -base64 32

# Update .env
NEXTAUTH_SECRET=your-new-secret
```

**Error: "Invalid callback URL"**
```bash
# Ensure NEXTAUTH_URL matches your domain
NEXTAUTH_URL=http://localhost:3000
```

**OAuth Login Fails**
- Verify OAuth app credentials
- Check redirect URLs match exactly
- Ensure `allowDangerousEmailAccountLinking` is NOT enabled

### Session Not Persisting

```bash
# Check cookie settings
# Should be httpOnly, secure (in production), sameSite

# Clear browser cookies
# Or test in incognito mode
```

## File Upload Issues

### Upload Fails

```bash
# Check MinIO is running
docker-compose ps minio

# Verify S3 credentials
# For local: minioadmin / minioadmin

# Check file size limits
# Default: 10MB, can be increased in config
```

### Document Processing Fails

```bash
# Check Inngest is running
docker-compose ps inngest

# View processing logs
docker-compose logs -f inngest

# Check supported formats
# PDF, DOCX, TXT, MD supported
```

### OCR Not Working

```bash
# Tesseract.js requires specific dependencies
# For local development, may need:
pnpm install tesseract.js

# Check OCR logs
# In docker-compose logs app
```

## Performance Issues

### Slow Chat Responses

```bash
# Check model being used
# Check response headers: X-Model-Used

# Monitor retrieval time
# Enable RAG metrics logging

# Optimize chunk size
# Smaller chunks = faster retrieval, less context
```

### High Memory Usage

```bash
# Check Node memory usage
node --inspect server.ts

# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev

# Check for memory leaks
# Use clinic.js: npx clinic doctor -- node server.ts
```

### Database Slow Queries

```bash
# Enable query logging in PostgreSQL
# Add to docker-compose.yml for postgres:
# command: postgres -c log_statement=all

# Analyze slow queries
EXPLAIN ANALYZE SELECT * FROM chunks WHERE ...;

# Add indexes if needed
CREATE INDEX CONCURRENTLY idx_chunks_workspace ON chunks(workspace_id);
```

## Docker Issues

### Container Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Rebuild containers
docker-compose down
docker-compose up --build

# Check port conflicts
lsof -ti:3000 | xargs kill -9
lsof -ti:5432 | xargs kill -9
```

### Volume Permission Errors

```bash
# Fix ownership
sudo chown -R $USER:$USER .

# Or use named volumes
docker-compose down -v
docker-compose up
```

### Out of Disk Space

```bash
# Clean up Docker
 docker system prune -a
 docker volume prune

# Check space usage
docker system df
```

## Build Issues

### TypeScript Errors

```bash
# Check types
pnpm type-check

# Skip type checking in build (not recommended)
# next.config.ts: typescript: { ignoreBuildErrors: true }
```

### Biome Linting Errors

```bash
# Auto-fix issues
pnpm lint:fix

# Or disable specific rules
# biome.json: "rules": { "suspicious": { "noConsoleLog": "off" } }
```

### Static Generation Fails

```bash
# For dynamic routes, use:
export const dynamic = 'force-dynamic';

# Or generate params
export async function generateStaticParams() {
  return [];
}
```

## Testing Issues

### Tests Won't Run

```bash
# Ensure database is running for integration tests
docker-compose up -d postgres

# Check test environment
# .env.test should point to test database

# Run specific test
pnpm vitest run tests/unit/example.test.ts
```

### Playwright Tests Fail

```bash
# Install browsers
pnpm exec playwright install

# Run in headed mode to see what's happening
pnpm test:e2e --headed

# Debug specific test
pnpm test:e2e --debug
```

### Coverage Not Generated

```bash
# Run with coverage
pnpm test:coverage

# Check coverage directory
ls coverage/
```

## Common Error Messages

### "Module not found"

```bash
# Check import path
# Use @/ alias for src/

# Clear module cache
rm -rf .next
pnpm dev
```

### "Cannot read properties of undefined"

```typescript
// Add null checks
const value = obj?.nested?.property;

// Or use default values
const { data = [] } = response ?? {};
```

### "Promise returned in non-async function"

```typescript
// Add async keyword
async function handler() {
  await someAsyncOperation();
}

// Or use .then()
function handler() {
  return someAsyncOperation().then(...);
}
```

## Getting Help

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* pnpm dev

# Or specific modules
DEBUG=prisma:* pnpm dev
```

### Log Collection

```bash
# Collect all logs for support
docker-compose logs > logs.txt 2>&1

# Include system info
uname -a >> logs.txt
node --version >> logs.txt
pnpm --version >> logs.txt
```

### Community Support

- [GitHub Issues](https://github.com/rejisterjack/rag-starter-kit/issues)
- [Discord Server](https://discord.gg/rag-starter-kit)
- [Documentation](../README.md)

## Quick Fixes

### Nuclear Option (Start Fresh)

```bash
# WARNING: This deletes all data!
docker-compose down -v
rm -rf node_modules .next
pnpm install
docker-compose up -d
pnpm db:migrate
pnpm dev
```

### Common Fixes Script

```bash
#!/bin/bash
# fix-common.sh

echo "Fixing common issues..."

# Clear caches
rm -rf node_modules/.cache
rm -rf .next

# Regenerate Prisma
pnpm db:generate

# Restart Docker services
docker-compose restart

# Verify
curl http://localhost:3000/api/health

echo "Done! Try running: pnpm dev"
```
