# Deployment Documentation

This directory contains comprehensive deployment documentation for the RAG Starter Kit.

## Quick Start

For a new production deployment:

1. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Configure Vercel**:
   - Connect your GitHub repository
   - Add environment variables from `.env`

3. **Set up database**:
   ```bash
   pnpm db:migrate:prod
   ```

4. **Deploy**:
   ```bash
   git push origin main
   ```
   Or manually: `vercel --prod`

## Documentation Index

| Document | Description |
|----------|-------------|
| [Production Checklist](./production-checklist.md) | Step-by-step pre and post-deployment checklist |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel Edge                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Next.js    │  │    API       │  │   Static     │      │
│  │   Frontend   │  │   Routes     │  │    Assets    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  PostgreSQL  │ │    Redis     │ │    S3/       │
    │  + pgvector  │ │   (Upstash)  │ │   Storage    │
    └──────────────┘ └──────────────┘ └──────────────┘
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                   ┌──────────────┐
                   │   OpenAI     │
                   │     API      │
                   └──────────────┘
```

## CI/CD Pipeline

```
Pull Request
     │
     ▼
┌─────────────┐
│   CI Job    │ ──→ Lint, Type Check, Test, Build
└─────────────┘
     │
     ▼
┌─────────────┐
│   Preview   │ ──→ Deploy to Vercel Preview
│ Deployment  │
└─────────────┘
     │
     ▼
Merge to Main
     │
     ▼
┌─────────────┐
│ Production  │ ──→ Deploy + DB Migration + Health Check
│  Deploy     │
└─────────────┘
     │
     ▼
┌─────────────┐
│    E2E      │ ──→ Run Playwright tests on production
│    Tests    │
└─────────────┘
```

## Environment Variables

See `.env.production.example` for all required variables.

### Critical (Required)

| Variable | Description |
|----------|-------------|
| `POSTGRES_PRISMA_URL` | Database connection with pooling |
| `POSTGRES_URL_NON_POOLING` | Direct database connection |
| `NEXTAUTH_SECRET` | Secret for JWT signing |
| `NEXTAUTH_URL` | Your production URL |
| `OPENAI_API_KEY` | OpenAI API key |

### Recommended

| Variable | Description |
|----------|-------------|
| `REDIS_URL` or `UPSTASH_REDIS_REST_URL` | Redis for rate limiting & presence |
| `SENTRY_DSN` | Error tracking |
| `GITHUB_CLIENT_ID` | OAuth login |

## Useful Commands

### Environment Setup
```bash
cp .env.example .env
# Edit .env with your values
```

### Database Migration
```bash
# Development
pnpm db:migrate

# Production
pnpm db:migrate:prod
```

### Database Backup
```bash
# Using Docker
pg_dump $DATABASE_URL > backup.sql

# Using Prisma
pnpm prisma migrate diff --from-url $DATABASE_URL --to-url $DATABASE_URL --script > schema.sql
```

## Monitoring

### Health Endpoint

```bash
curl https://your-domain.com/api/health
```

Returns:
```json
{
  "status": "healthy",
  "checks": [
    { "name": "database", "healthy": true, "responseTime": 12 },
    { "name": "vector_extension", "healthy": true },
    { "name": "openai", "healthy": true }
  ],
  "system": {
    "uptime": 3600,
    "memory": { "used": 128, "total": 512 }
  }
}
```

### Sentry Integration

Errors are automatically tracked when `SENTRY_DSN` is configured.

### Vercel Analytics

Enable in dashboard: `Settings → Analytics`

## Docker Deployment

For self-hosted deployment:

```bash
# Build
docker build -f docker/Dockerfile -t rag-starter-kit .

# Run with docker-compose
docker-compose -f docker/docker-compose.prod.yml up -d
```

## Support

- [Production Checklist](./production-checklist.md) - Complete deployment steps
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- GitHub Issues - Bug reports and feature requests
