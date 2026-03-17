# Docker Deployment Guide

Complete guide for running the RAG Starter Kit using Docker Compose.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Commands](#commands)
- [Volume Management](#volume-management)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## Quick Start

```bash
# 1. Start infrastructure services
docker-compose -f docker/docker-compose.yml up -d

# Or use the Makefile
make dev

# 2. Verify services are running
docker-compose -f docker/docker-compose.yml ps

# 3. Connect to PostgreSQL with pgvector
psql postgres://raguser:ragpassword@localhost:5432/ragdb -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# 4. View logs
make logs
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                     (rag-network: 172.20.0.0/16)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Next.js    │──────▶  PostgreSQL  │      │    Redis     │  │
│  │   App (:3000)│      │  (:5432)     │      │   (:6379)    │  │
│  │              │      │              │      │              │  │
│  │  - Chat UI   │      │  - pgvector  │      │  - Cache     │  │
│  │  - RAG API   │      │  - Documents │      │  - Rate Limit│  │
│  │  - Auth      │      │  - Embeddings│      │  - Sessions  │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         │                     │                     │           │
│         └─────────────────────┴─────────────────────┘           │
│                                                                  │
│  Volumes:                                                        │
│  - postgres_data  →  /var/lib/postgresql/data                   │
│  - redis_data     →  /data                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Make (optional, for using Makefile commands)

## Configuration

### 1. Environment Setup

Copy the Docker environment template:

```bash
cp .env.docker .env.docker.local
```

Edit `.env.docker.local` with your values:

```env
# Database credentials
POSTGRES_USER=raguser
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=ragdb

# OpenAI API
OPENAI_API_KEY=sk-your-key

# NextAuth
NEXTAUTH_SECRET=your-secret-min-32-chars
```

### 2. Docker Compose Override (Optional)

Create `docker/docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'

services:
  postgres:
    ports:
      - "5433:5432"  # Use different port locally
    environment:
      POSTGRES_PASSWORD: my-local-password
  
  redis:
    command: redis-server --appendonly yes --requirepass localpass
```

## Commands

### Using Make (Recommended)

| Command | Description |
|---------|-------------|
| `make dev` | Start all Docker services |
| `make stop` | Stop all services |
| `make logs` | View logs from all services |
| `make db-reset` | Reset PostgreSQL database |
| `make clean` | Remove all containers and volumes |

### Using Docker Compose Directly

```bash
# Start services
docker-compose -f docker/docker-compose.yml up -d

# Stop services
docker-compose -f docker/docker-compose.yml down

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# View specific service logs
docker-compose -f docker/docker-compose.yml logs -f postgres

# Restart a service
docker-compose -f docker/docker-compose.yml restart redis

# Scale services (if applicable)
docker-compose -f docker/docker-compose.yml up -d --scale app=2
```

## Volume Management

### Persistent Volumes

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL database files |
| `redis_data` | `/data` | Redis persistence (AOF) |

### Backup & Restore

```bash
# Backup PostgreSQL
docker exec rag-postgres pg_dump -U raguser ragdb > backup.sql

# Restore PostgreSQL
docker exec -i rag-postgres psql -U raguser ragdb < backup.sql

# Backup Redis
docker exec rag-redis redis-cli BGSAVE
docker cp rag-redis:/data/dump.rdb ./redis-backup.rdb

# Restore Redis
docker cp ./redis-backup.rdb rag-redis:/data/dump.rdb
```

### Clean Start (Remove All Data)

```bash
# Stop and remove containers + volumes
docker-compose -f docker/docker-compose.yml down -v

# Or using Make
make clean
```

## Troubleshooting

### PostgreSQL Issues

#### Connection Refused

```bash
# Check if container is running
docker ps | grep rag-postgres

# Check logs
docker-compose -f docker/docker-compose.yml logs postgres

# Verify port mapping
docker port rag-postgres
```

#### pgvector Extension Not Found

```bash
# Connect to container
docker exec -it rag-postgres psql -U raguser -d ragdb

# Check extensions
\dx

# Manual installation
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Database Already Exists

```bash
# Remove volume and restart
docker-compose -f docker/docker-compose.yml down -v
docker-compose -f docker/docker-compose.yml up -d
```

### Redis Issues

#### Memory Warnings

```bash
# Check memory usage
docker exec rag-redis redis-cli INFO memory

# Clear all data (use with caution)
docker exec rag-redis redis-cli FLUSHALL
```

#### Persistence Issues

```bash
# Check AOF status
docker exec rag-redis redis-cli INFO persistence

# Rewrite AOF file
docker exec rag-redis redis-cli BGREWRITEAOF
```

### Application Issues

#### Build Failures

```bash
# Rebuild without cache
docker-compose -f docker/docker-compose.yml build --no-cache app

# Check Dockerfile syntax
docker build -f docker/Dockerfile .
```

#### Prisma Errors

```bash
# Generate Prisma client inside container
docker exec -it rag-app npx prisma generate

# Run migrations
docker exec -it rag-app npx prisma migrate deploy

# Open Prisma Studio
docker exec -it rag-app npx prisma studio
```

### Network Issues

```bash
# List networks
docker network ls

# Inspect network
docker network inspect rag-network

# Test connectivity between containers
docker exec rag-app ping postgres
docker exec rag-app ping redis
```

### Common Error Messages

| Error | Solution |
|-------|----------|
| `bind: address already in use` | Port 5432 or 6379 is in use. Stop local PostgreSQL/Redis or change ports in docker-compose.yml |
| `permission denied` | Check file permissions on mounted volumes |
| `disk full` | Clean up Docker volumes: `docker system prune -v` |
| `unhealthy container` | Check healthcheck logs: `docker inspect --format='{{.State.Health}}' rag-postgres` |

## Production Deployment

### Security Checklist

- [ ] Change default passwords in `.env.docker`
- [ ] Enable Redis authentication in `redis.conf`
- [ ] Use Docker secrets or external vault for sensitive data
- [ ] Restrict network access with firewall rules
- [ ] Enable SSL/TLS for database connections
- [ ] Run containers as non-root user (already configured)
- [ ] Regular security updates: `docker-compose pull && docker-compose up -d`

### Performance Tuning

```yaml
# docker-compose.prod.yml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
  
  redis:
    sysctls:
      - net.core.somaxconn=1024
    deploy:
      resources:
        limits:
          memory: 512M
```

### Monitoring

```bash
# Container stats
docker stats

# Resource usage
docker system df

# Logs aggregation
docker-compose -f docker/docker-compose.yml logs -f --tail=100
```

## Additional Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Redis Configuration](https://redis.io/docs/management/config/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
