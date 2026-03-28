# Kubernetes Deployment Guide

This guide covers deploying the RAG Starter Kit to Kubernetes.

## Prerequisites

- Kubernetes cluster (v1.24+)
- `kubectl` configured to access your cluster
- `kustomize` (v5.0+) or `kubectl apply -k`
- Container registry for your Docker images
- Ingress controller (nginx recommended)
- Storage class for persistent volumes

## Quick Start

### 1. Build and Push Docker Image

```bash
# Build the image
docker build -t your-registry/rag-starter-kit:latest .

# Push to your registry
docker push your-registry/rag-starter-kit:latest
```

### 2. Configure Secrets

Edit `k8s/secrets.yaml` and replace all `CHANGE_ME` values:

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY (32 bytes hex)
openssl rand -hex 32

# Generate PLAUSIBLE_SECRET_KEY_BASE (min 64 chars)
openssl rand -base64 64
```

### 3. Configure Ingress

Edit `k8s/app.yaml` and update the Ingress host:

```yaml
spec:
  rules:
    - host: rag.yourdomain.com # Change this
```

### 4. Deploy with Kustomize

```bash
# Deploy all resources
kubectl apply -k k8s/

# Or deploy individually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/app.yaml
```

### 5. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n rag-starter-kit

# Check services
kubectl get svc -n rag-starter-kit

# Check ingress
kubectl get ingress -n rag-starter-kit

# View logs
kubectl logs -f deployment/rag-app -n rag-starter-kit
```

## Architecture

The deployment includes:

| Component    | Type        | Replicas | Purpose                      |
| ------------ | ----------- | -------- | ---------------------------- |
| `rag-app`    | Deployment  | 2        | Next.js application          |
| `postgres`   | StatefulSet | 1        | PostgreSQL with pgvector     |
| `redis`      | Deployment  | 1        | Rate limiting & caching      |
| `minio`      | Deployment  | 1        | S3-compatible object storage |
| `minio-init` | Job         | 1        | Initialize MinIO buckets     |

## Configuration

### Environment Variables

All configuration is managed through:

- **ConfigMap** (`rag-config`): Non-sensitive configuration
- **Secrets** (`rag-secrets`): Sensitive data (passwords, API keys)

### Resource Limits

Default resource allocations:

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
| --------- | ----------- | --------- | -------------- | ------------ |
| rag-app   | 500m        | 2000m     | 512Mi          | 2Gi          |
| postgres  | 250m        | 1000m     | 256Mi          | 1Gi          |
| redis     | 100m        | 500m      | 128Mi          | 512Mi        |
| minio     | 250m        | 1000m     | 256Mi          | 1Gi          |

### Scaling

The app deployment includes a HorizontalPodAutoscaler (HPA):

- **Min replicas**: 2
- **Max replicas**: 10
- **Scale up**: 50% increase when CPU > 70% or Memory > 80%
- **Scale down**: 10% decrease with 5-minute stabilization

## Database Migrations

Migrations run automatically via an init container when the app starts. To run manually:

```bash
kubectl exec -it deployment/rag-app -n rag-starter-kit -- npx prisma migrate deploy
```

## Backup & Recovery

### Database Backup

```bash
# Create a backup job
kubectl create job --from=cronjob/postgres-backup postgres-backup-manual -n rag-starter-kit

# Or exec into postgres
kubectl exec -it statefulset/postgres -n rag-starter-kit -- pg_dump -U postgres ragdb > backup.sql
```

### MinIO Backup

```bash
# Use mc client
kubectl exec -it deployment/minio -n rag-starter-kit -- mc mirror local/documents /backup/documents
```

## Monitoring

### Health Checks

All services include liveness and readiness probes:

- **App**: `GET /api/health`
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`
- **MinIO**: `GET /minio/health/live`

### Logs

```bash
# View app logs
kubectl logs -f deployment/rag-app -n rag-starter-kit

# View postgres logs
kubectl logs -f statefulset/postgres -n rag-starter-kit

# View all logs
kubectl logs -f -l app.kubernetes.io/part-of=rag-starter-kit -n rag-starter-kit
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n rag-starter-kit

# Check events
kubectl get events -n rag-starter-kit --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it deployment/rag-app -n rag-starter-kit -- nc -zv postgres 5432

# Check postgres logs
kubectl logs statefulset/postgres -n rag-starter-kit
```

### MinIO Issues

```bash
# Check minio health
kubectl exec -it deployment/minio -n rag-starter-kit -- curl -f http://localhost:9000/minio/health/live

# List buckets
kubectl exec -it deployment/minio -n rag-starter-kit -- mc ls local/
```

## Production Considerations

### TLS/SSL

Configure TLS in the Ingress:

```yaml
spec:
  tls:
    - hosts:
        - rag.yourdomain.com
      secretName: rag-tls-secret
```

Create the TLS secret:

```bash
kubectl create secret tls rag-tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n rag-starter-kit
```

### Resource Quotas

Apply resource quotas to the namespace:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: rag-quota
  namespace: rag-starter-kit
spec:
  hard:
    requests.cpu: '10'
    requests.memory: 20Gi
    limits.cpu: '20'
    limits.memory: 40Gi
    pods: '20'
```

### Network Policies

Restrict network access:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: rag-network-policy
  namespace: rag-starter-kit
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/part-of: rag-starter-kit
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
  egress:
    - to:
        - podSelector: {}
```

## Cleanup

```bash
# Delete all resources
kubectl delete -k k8s/

# Or delete namespace (deletes everything)
kubectl delete namespace rag-starter-kit
```
