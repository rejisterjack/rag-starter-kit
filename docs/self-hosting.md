# Self-Hosting with Docker

If you prefer to self-host instead of using Vercel, you can run the RAG Starter Kit with Docker.

> **Note:** The primary deployment target is Vercel. Docker support is community-maintained.

## Prerequisites

- Docker and Docker Compose
- At least 2GB RAM
- 10GB disk space

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/your-org/rag-starter-kit.git
cd rag-starter-kit
cp .env.example .env
# Edit .env with your API keys and database URL
```

### 2. Create a Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun db:generate
RUN bun build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### 3. Create docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ragdb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

### 4. Run migrations and start

```bash
# Update .env with local database URLs
# DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ragdb?sslmode=disable
# UPSTASH_REDIS_REST_URL= (leave empty — app uses in-memory fallback)

# Start services
docker compose up -d

# Run migrations
docker compose exec app npx prisma migrate deploy

# pgvector ships with the postgres service (pgvector/pgvector:pg16)
```

### 5. Access the app

Open http://localhost:7392 and register an account.

## Differences from Vercel Deployment

| Feature | Vercel | Docker |
|---------|--------|--------|
| Function timeout | 10s (Hobby) | Unlimited |
| Background jobs | Inngest Cloud | Inngest local or built-in cron |
| Rate limiting | Upstash Redis or DB | Local Redis or in-memory |
| File storage | Cloudinary | Cloudinary or local volume |
| SSL | Automatic | Configure with reverse proxy |
| Scaling | Automatic | Manual (docker compose scale) |

## Production Considerations

For production Docker deployments:

1. Use a reverse proxy (nginx/Caddy) for SSL termination
2. Set `output: "standalone"` in `next.config.ts`
3. Use external PostgreSQL and Redis instead of Docker containers
4. Configure proper backup strategy for PostgreSQL
5. Set up monitoring (Sentry, Prometheus/Grafana)
6. Use Docker secrets or a secrets manager for sensitive env vars
