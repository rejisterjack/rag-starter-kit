# Complete Docker Architecture Guide

## Overview

This document provides a comprehensive, in-depth guide to the Docker architecture of the RAG Starter Kit. The entire stack is containerized with **zero host dependencies** - everything runs inside Docker containers.

## Architecture Philosophy

### 100% Containerized
- No local installations required (Node.js, PostgreSQL, Redis, etc.)
- Consistent environment across all machines
- Easy onboarding - just Docker and Docker Compose
- Production parity - dev and prod use same base images

### Service-Oriented Design
Each component is a separate container with a single responsibility:
- **app**: Next.js application
- **db**: PostgreSQL with pgvector extension
- **redis**: Redis for caching, rate limiting, and presence
- **minio**: S3-compatible object storage
- **inngest**: Background job processing
- **plausible**: Privacy-focused analytics

---

## Container Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Docker Host Network                                  │
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   Port 3000 │     │   Port 5555 │     │   Port 8288 │                   │
│  │   (App)     │     │  (Prisma)   │     │  (Inngest)  │                   │
│  └──────┬──────┘     └─────────────┘     └─────────────┘                   │
│         │                                                                   │
│  ┌──────┴──────────────────────────────────────────────────────────────┐   │
│  │                         rag-network (bridge)                         │   │
│  │                                                                      │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │   │
│  │   │   app    │◄──►│    db    │    │  redis   │    │  minio   │     │   │
│  │   │  (Next)  │    │(Postgres)│    │  (Cache) │    │   (S3)   │     │   │
│  │   └────┬─────┘    └──────────┘    └──────────┘    └──────────┘     │   │
│  │        │                                                            │   │
│  │   ┌────┴────┐    ┌──────────┐    ┌──────────┐                      │   │
│  │   │  inngest│    │ plausible│    │minio-init│                      │   │
│  │   │  (Jobs) │    │(Analytics│    │ (Setup)  │                      │   │
│  │   └─────────┘    └──────────┘    └──────────┘                      │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Deep Dive

### 1. Application Container (`app`)

**Purpose**: Next.js 15 application with full-stack capabilities

**Dockerfile Strategy**: Multi-stage build
```
development ──► deps ──► builder ──► runner
    │                              
    └─ Hot reload              ──► Production
```

**Development Stage**:
- Volume mounts for hot reload
- Source code mounted from host
- Node modules in anonymous volume
- Fast iteration cycle

**Production Stage**:
- Standalone Next.js output
- Minimal image size (~150MB)
- No build dependencies
- Prisma engine included

**Key Configuration**:
```yaml
environment:
  # Internal service discovery via Docker DNS
  DATABASE_URL: postgresql://postgres:postgres@rag-db:5432/ragdb
  REDIS_URL: redis://rag-redis:6379
  S3_ENDPOINT: http://rag-minio:9000
```

**Health Check**:
```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health')"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

### 2. Database Container (`db`)

**Purpose**: PostgreSQL 16 with pgvector extension for vector similarity search

**Image**: `pgvector/pgvector:pg16`

**Why pgvector?**:
- Native vector data type
- HNSW and IVFFlat index support
- Cosine similarity operations
- Integration with Prisma ORM

**Configuration**:
```yaml
environment:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
  POSTGRES_DB: ragdb

volumes:
  postgres_data:/var/lib/postgresql/data
```

**Multiple Databases**:
- `ragdb`: Main application database
- `plausible`: Analytics database (created on first run)

**Health Check**:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d ragdb"]
  interval: 5s
  timeout: 5s
  retries: 10
  start_period: 10s
```

---

### 3. Redis Container (`redis`)

**Purpose**: In-memory data store for rate limiting, caching, and real-time presence

**Image**: `redis:7-alpine` (lightweight)

**Configuration**:
```yaml
command: >
  redis-server
  --maxmemory 256mb          # Memory limit
  --maxmemory-policy allkeys-lru  # Eviction policy
  --appendonly yes           # Persistence
```

**Use Cases**:
- **Rate Limiting**: Sliding window counters
- **Caching**: Query results, session data
- **Presence**: Online status, typing indicators
- **Pub/Sub**: Real-time notifications

---

### 4. MinIO Container (`minio`)

**Purpose**: S3-compatible object storage for documents, exports, and attachments

**Why MinIO?**:
- S3 API compatible
- Self-hosted (data stays local)
- Works with AWS SDK
- No cloud dependencies

**Configuration**:
```yaml
environment:
  MINIO_ROOT_USER: minioadmin
  MINIO_ROOT_PASSWORD: minioadmin

command: server /data --console-address ":9001"
```

**Buckets**:
- `documents`: User uploaded files (PDFs, DOCX, etc.)
- `exports`: Generated exports (conversations, data)
- `attachments`: Chat attachments

**Init Container** (`minio-init`):
- Runs once after MinIO is healthy
- Creates buckets if they don't exist
- Sets public read access on exports bucket
- Exits after completion

---

### 5. Inngest Container (`inngest`)

**Purpose**: Background job processing and event-driven workflows

**Key Features**:
- Document processing pipeline
- Async job queuing
- Scheduled functions
- Event fan-out

**Configuration**:
```yaml
command: "inngest dev -u http://rag-app:3000/api/inngest"
```

**Job Types**:
- Document ingestion and chunking
- Embedding generation
- Export generation
- Cleanup tasks

---

### 6. Plausible Container (`plausible`)

**Purpose**: Privacy-focused web analytics (GDPR compliant, no cookies)

**Why Plausible?**:
- Lightweight (~1MB script)
- No personal data collection
- Self-hosted (data ownership)
- Simple dashboard

**Configuration**:
```yaml
environment:
  DATABASE_URL: postgres://postgres:postgres@rag-db:5432/plausible
  SECRET_KEY_BASE: ${PLAUSIBLE_SECRET_KEY_BASE}
  BASE_URL: http://localhost:8000
  DISABLE_REGISTRATION: false
```

---

## Development Environment

### File: `docker-compose.dev.yml`

**Characteristics**:
- **Hot Reload**: Source code mounted as volume
- **Debug Ports**: Exposed for debugging
- **Dev Tools**: Prisma Studio, Inngest Dashboard
- **Volume Mounts**: Code changes reflect immediately

**Volume Strategy**:
```yaml
volumes:
  - .:/app           # Source code (host → container)
  - /app/node_modules # Anonymous volume (isolated)
  - /app/.next        # Anonymous volume (isolated)
```

**Port Mapping**:
| Port | Service | Purpose |
|------|---------|---------|
| 3000 | Next.js | Application |
| 5555 | Prisma | Database GUI |
| 8288 | Inngest | Job dashboard |
| 9001 | MinIO | S3 console |
| 8000 | Plausible | Analytics |
| 6379 | Redis | (optional) |

---

## Production Environment

### File: `docker-compose.prod.yml`

**Characteristics**:
- **Immutable**: No volume mounts for code
- **Optimized**: Multi-stage builds, minimal images
- **Resilient**: Restart policies, health checks
- **Secure**: Secrets via environment variables
- **Scalable**: Resource limits defined

**Key Differences from Dev**:

1. **No Volume Mounts**:
   ```yaml
   # Dev
   volumes:
     - .:/app  # ❌ Not in production
   
   # Prod
   # No volumes - immutable container
   ```

2. **Build Target**:
   ```yaml
   # Dev
   target: development
   
   # Prod
   target: runner  # Optimized production image
   ```

3. **Restart Policy**:
   ```yaml
   restart: unless-stopped
   ```

4. **Resource Limits**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: "2"
         memory: 2G
       reservations:
         cpus: "0.5"
         memory: 512M
   ```

5. **Backup Service** (optional):
   ```yaml
   # Enable with: docker-compose --profile backup up -d
   backup:
     profiles: [backup]
     # Daily automated backups
   ```

---

## Networking

### Docker Network: `rag-network`

**Type**: Bridge

**DNS Resolution**:
- Container names resolve to IPs automatically
- `rag-db` → database container IP
- `rag-redis` → Redis container IP
- `rag-minio` → MinIO container IP

**Communication Flow**:
```
Client Request
    │
    ▼
Host Port 3000
    │
    ▼
App Container
    ├──► DB (internal DNS: rag-db:5432)
    ├──► Redis (internal DNS: rag-redis:6379)
    ├──► MinIO (internal DNS: rag-minio:9000)
    └──► Inngest (external: localhost:8288)
```

**Security**:
- Only app container exposed to host
- Internal services communicate via private network
- No direct external access to database or Redis

---

## Data Persistence

### Volumes

| Volume | Purpose | Backup |
|--------|---------|--------|
| `postgres_data` | Database files | Critical |
| `redis_data` | Redis persistence | Optional |
| `minio_data` | S3 objects | Critical |

### Backup Strategy

**Development**:
```bash
# Manual backup
pg_dump postgresql://postgres:postgres@localhost:5432/ragdb > backup.sql

# Via Make
make backup
```

**Production** (with backup profile):
```bash
# Enable automated daily backups
docker-compose -f docker-compose.prod.yml --profile backup up -d

# Backups saved to ./backups/
# Retention: 7 days (configurable)
```

---

## Environment Configuration

### Configuration Flow

```
.env.example (template)
      │
      ▼ (copy)
   .env (actual values, gitignored)
      │
      ▼ (loaded by)
docker-compose.yml
      │
      ▼ (passed to)
   Containers
```

### Required Variables

```bash
# AI Providers
OPENROUTER_API_KEY=sk-or-v1-xxx       # Get from openrouter.ai/keys
GOOGLE_API_KEY=xxx                     # Get from aistudio.google.com/app/apikey

# Auth
NEXTAUTH_SECRET=xxx                    # openssl rand -base64 32

# Production Only
POSTGRES_PASSWORD=xxx                  # Strong password
PLAUSIBLE_SECRET_KEY_BASE=xxx          # openssl rand -base64 48
```

### Service URLs (Internal)

All services use Docker DNS names:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@rag-db:5432/ragdb

# Redis
REDIS_URL=redis://rag-redis:6379

# S3/MinIO
S3_ENDPOINT=http://rag-minio:9000
```

---

## Health Checks

### Implementation

Every service has health checks to ensure reliability:

```yaml
# Application
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health')"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s

# Database
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d ragdb"]
  interval: 5s
  timeout: 5s
  retries: 10

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 3s
  retries: 5

# MinIO
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Dependency Management

Services wait for dependencies to be healthy:

```yaml
app:
  depends_on:
    db:
      condition: service_healthy  # Wait for DB
    redis:
      condition: service_healthy  # Wait for Redis
    minio:
      condition: service_healthy  # Wait for MinIO
```

---

## Security Considerations

### 1. No Host Exposure

Internal services NOT exposed to host:
```yaml
# ❌ No port mapping
db:
  # Only accessible via docker network
  # NOT: ports: ["5432:5432"]
```

### 2. Secrets Management

```yaml
# ✅ Good - use environment variables
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

# ❌ Bad - hardcoded secrets
environment:
  POSTGRES_PASSWORD: "secret123"
```

### 3. Non-Root User (Production)

```dockerfile
# Dockerfile production stage
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs
```

### 4. Read-Only Filesystem (Production)

Volumes for writable areas only:
```yaml
volumes:
  - /tmp  # Writable
  # Rest of filesystem is read-only
```

---

## Build Optimization

### Multi-Stage Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
# Install packages

# Stage 2: Builder
FROM node:20-alpine AS builder
# Build application

# Stage 3: Runner (production)
FROM node:20-alpine AS runner
# Only runtime files
# ~150MB final image
```

### BuildKit Features

```bash
# Enable BuildKit
DOCKER_BUILDKIT=1 docker-compose build

# Cache mounts for faster rebuilds
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install
```

---

## Development Workflow

### Quick Start

```bash
# 1. Clone
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit

# 2. Configure
cp .env.example .env
# Edit .env with your API keys

# 3. Start
docker-compose up

# 4. Access
open http://localhost:3000
```

### Common Commands

```bash
# Development
docker-compose up              # Start all services
docker-compose up -d           # Detached mode
docker-compose down            # Stop all
docker-compose logs -f app     # Follow app logs
docker-compose exec app sh     # Shell into app

# Database
docker-compose exec db psql -U postgres -d ragdb
docker-compose exec app pnpm db:migrate
docker-compose exec app pnpm prisma studio

# Production
docker-compose -f docker-compose.prod.yml up -d
```

---

## Production Deployment

### Single Server

```bash
# 1. Copy compose files and .env
scp docker-compose.prod.yml .env user@server:/app/

# 2. SSH and start
ssh user@server
cd /app
docker-compose -f docker-compose.prod.yml up -d
```

### With Backups

```bash
# Create backup directory
mkdir -p backups

# Start with backup service
docker-compose -f docker-compose.prod.yml --profile backup up -d

# Backups saved to ./backups/ automatically
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs [service-name]

# Check health
docker-compose ps

# Verify env
docker-compose config
```

### Database Connection Issues

```bash
# Test from app container
docker-compose exec app nc -zv rag-db 5432

# Check DB logs
docker-compose logs db
```

### Volume Issues

```bash
# List volumes
docker volume ls

# Clean up (⚠️ destroys data)
docker-compose down -v
```

---

## Summary

### What's Containerized?

| Component | Container | Local Install? |
|-----------|-----------|----------------|
| Next.js App | ✅ Yes | ❌ No |
| PostgreSQL | ✅ Yes | ❌ No |
| Redis | ✅ Yes | ❌ No |
| MinIO/S3 | ✅ Yes | ❌ No |
| Inngest | ✅ Yes | ❌ No |
| Plausible | ✅ Yes | ❌ No |
| Node.js | ✅ Yes | ❌ No |

### Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 2 CPU cores recommended

### Benefits

1. **Zero Setup**: One command to start everything
2. **Consistency**: Same environment on all machines
3. **Isolation**: Services can't interfere with each other
4. **Portability**: Runs anywhere Docker runs
5. **Scalability**: Easy to scale individual services

---

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/dockerfile_best-practices/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [Prisma with Docker](https://www.prisma.io/docs/guides/deployment/deploying-to-docker)
