# Deployment Guide

Comprehensive guide for deploying the RAG Starter Kit to various platforms.

## Overview

The RAG Starter Kit can be deployed in multiple configurations:
- **Vercel**: Easiest for Next.js apps
- **Docker**: Full control, self-hosted
- **Railway**: Simple container deployment
- **AWS/GCP/Azure**: Enterprise cloud

## Environment-Specific Configuration

### Production Environment Variables

```bash
# Core
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-production-secret

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DIRECT_URL=postgresql://user:pass@host:5432/db  # For migrations

# AI Providers
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_API_KEY=AIzaSy...

# Storage
S3_ENDPOINT=s3.amazonaws.com
S3_BUCKET=rag-documents
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Analytics
PLAUSIBLE_DOMAIN=your-domain.com
POSTHOG_KEY=phc_...
```

## Deployment Options

### Option 1: Vercel (Recommended for Frontend)

#### Prerequisites

- Vercel account
- Connected GitHub repository

#### Steps

1. **Import Project**
   ```bash
   # Use Vercel CLI
   npm i -g vercel
   vercel
   ```

2. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables from `.env.example`

3. **Configure Build Settings**
   ```json
   // vercel.json
   {
     "buildCommand": "prisma generate && next build",
     "installCommand": "pnpm install",
     "framework": "nextjs"
   }
   ```

4. **Database Setup**
   - Use Vercel Postgres or external provider
   - Run migrations:
     ```bash
     vercel --prod
     vercel env pull .env.production
     pnpm prisma migrate deploy
     ```

#### Vercel Configuration

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/webhooks/(.*)",
      "headers": {
        "Cache-Control": "no-cache"
      }
    }
  ],
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Option 2: Docker (Full Stack)

#### Single Container

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm prisma generate && pnpm build

# Production
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

#### Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/rag
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
    depends_on:
      - postgres
      - redis
      - minio
    networks:
      - rag-network

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: rag
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - rag-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - rag-network

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - rag-network

  inngest:
    image: inngest/inngest:latest
    command: "inngest dev -u http://app:3000/api/inngest"
    ports:
      - "8288:8288"
    networks:
      - rag-network

  plausible:
    image: plausible/analytics:latest
    environment:
      - BASE_URL=http://localhost:8000
      - SECRET_KEY_BASE=${PLAUSIBLE_SECRET}
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/plausible
    ports:
      - "8000:8000"
    networks:
      - rag-network

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  rag-network:
    driver: bridge
```

#### Deploy with Docker Compose

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec app pnpm prisma migrate deploy

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

### Option 3: Railway

1. **Connect Repository**
   - Link GitHub repo to Railway

2. **Add Services**
   - PostgreSQL
   - Redis
   - MinIO (optional)

3. **Configure Environment**
   ```bash
   # Railway automatically adds:
   # DATABASE_URL, REDIS_URL
   
   # Manually add:
   # NEXTAUTH_SECRET, OPENROUTER_API_KEY, etc.
   ```

4. **Deploy**
   - Auto-deploy on git push
   - Or deploy manually from dashboard

### Option 4: AWS (EC2 + RDS + ElastiCache)

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        AWS                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Route 53  │  │ CloudFront  │  │      WAF        │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          ▼                              │
│                   ┌─────────────┐                       │
│                   │  ALB/ELB    │                       │
│                   └──────┬──────┘                       │
│                          │                              │
│         ┌────────────────┼────────────────┐             │
│         ▼                ▼                ▼             │
│    ┌─────────┐     ┌─────────┐     ┌─────────┐         │
│    │ EC2 #1  │     │ EC2 #2  │     │ EC2 #3  │         │
│    │ (App)   │     │ (App)   │     │ (App)   │         │
│    └────┬────┘     └────┬────┘     └────┬────┘         │
│         │               │               │               │
│         └───────────────┼───────────────┘               │
│                         ▼                               │
│    ┌─────────┐  ┌─────────────┐  ┌───────────────┐     │
│    │  RDS    │  │ ElastiCache │  │      S3       │     │
│    │(Postgres│  │   (Redis)   │  │  (Documents)  │     │
│    └─────────┘  └─────────────┘  └───────────────┘     │
└─────────────────────────────────────────────────────────┘
```

#### Terraform Configuration

```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "rag-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier        = "rag-postgres"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.rag.name
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "rag-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  
  security_group_ids = [aws_security_group.redis.id]
  subnet_group_name  = aws_elasticache_subnet_group.rag.name
}

# EC2 Instances
resource "aws_launch_template" "app" {
  name_prefix   = "rag-app-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = "t3.small"
  
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    database_url = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
    redis_url    = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
  }))
}

# Auto Scaling Group
resource "aws_autoscaling_group" "app" {
  name                = "rag-app-asg"
  vpc_zone_identifier = module.vpc.private_subnets
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"
  min_size            = 2
  max_size            = 4
  desired_capacity    = 2
  
  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }
}
```

### Option 5: Kubernetes

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rag-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rag-app
  template:
    metadata:
      labels:
        app: rag-app
    spec:
      containers:
        - name: app
          image: your-registry/rag-starter-kit:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
            - name: NEXTAUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: nextauth-secret
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: rag-app-service
spec:
  selector:
    app: rag-app
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

## Database Migration Strategy

### Zero-Downtime Migrations

```bash
# 1. Deploy new code with backward-compatible schema changes
# 2. Run migrations
pnpm prisma migrate deploy

# 3. Verify
pnpm prisma migrate status

# 4. Deploy final code
```

### Rollback Plan

```bash
# If migration fails
pnpm prisma migrate resolve --rolled-back "migration_name"

# Restore from backup (if needed)
pg_restore -d $DATABASE_URL backup.dump
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install Certbot
docker run -it --rm \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  certbot/certbot certonly \
  --standalone \
  -d your-domain.com
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/rag
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring & Alerting

### Health Checks

```typescript
// src/app/api/health/route.ts
export async function GET() {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
  ]);
  
  const allHealthy = checks.every(c => c.healthy);
  
  return Response.json(
    {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: Object.fromEntries(checks.map(c => [c.name, c])),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
```

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check connectivity
nc -zv your-db-host 5432

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"
```

**Build Failures**
```bash
# Clear cache
rm -rf .next node_modules
pnpm install
pnpm build
```

**Memory Issues**
```bash
# Check memory usage
docker stats

# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

## Production Checklist

- [ ] Environment variables configured
- [ ] SSL/TLS certificates installed
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Error tracking (Sentry)
- [ ] Analytics configured
- [ ] Documentation updated

## Related Documentation

- [Docker Architecture](../DOCKER_ARCHITECTURE.md)
- [Production Checklist](../deployment/production-checklist.md)
- [Troubleshooting](./troubleshooting.md)
