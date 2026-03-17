# Docker Infrastructure for RAG Starter Kit

This directory contains the Docker infrastructure for running the RAG Starter Kit in development and production environments.

## Quick Start

```bash
# From project root
cd ..
make dev
```

## Directory Structure

```
docker/
├── docker-compose.yml      # Main compose file with all services
├── Dockerfile              # Multi-stage build for Next.js app
├── .dockerignore           # Files to exclude from Docker build
├── README.md               # This file
├── postgres/
│   └── init/
│       └── 01-init.sql     # PostgreSQL initialization (pgvector)
└── redis/
    └── redis.conf          # Redis configuration
```

## Services

### PostgreSQL (pgvector)

- **Image**: `pgvector/pgvector:pg16`
- **Port**: `5432`
- **Features**:
  - pgvector extension pre-installed
  - Persistent volume for data
  - Health check configured

### Redis

- **Image**: `redis:7-alpine`
- **Port**: `6379`
- **Features**:
  - Persistence enabled (AOF)
  - Memory limits configured
  - LRU eviction policy

### Application (Optional)

- **Build**: Multi-stage Dockerfile
- **Port**: `3000`
- **Features**:
  - Production-optimized
  - Standalone output
  - Health check endpoint

## Environment Variables

Copy `.env.docker` to `.env.docker.local` and customize:

```bash
cp ../.env.docker ../.env.docker.local
```

## Common Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset database (WARNING: data loss)
docker-compose down -v

# Access PostgreSQL
docker exec -it rag-postgres psql -U raguser -d ragdb

# Access Redis
docker exec -it rag-redis redis-cli
```

## Production Considerations

1. **Security**:
   - Change default passwords
   - Enable Redis authentication
   - Use Docker secrets for sensitive data

2. **Performance**:
   - Adjust memory limits based on workload
   - Use connection pooling
   - Enable query caching

3. **Monitoring**:
   - Set up log aggregation
   - Monitor container resource usage
   - Configure health check alerts

## Troubleshooting

See [docs/deployment/docker.md](../docs/deployment/docker.md) for detailed troubleshooting guide.
