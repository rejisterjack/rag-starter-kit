# Disaster Recovery Procedures

## Overview

This document covers backup strategies, recovery procedures, and verification steps for RAG Starter Kit deployments.

## Backup Strategy by Provider

### Prisma Postgres (Accelerate)
- **Automatic backups**: Managed by Prisma with point-in-time recovery
- **Export**: `pg_dump $DIRECT_URL > backup_$(date +%Y%m%d).sql`
- **Console**: Manage backups at [console.prisma.io](https://console.prisma.io)

### Supabase
- **Automatic backups**: Daily snapshots on Pro plan, no automatic backups on free tier
- **Manual export**: `pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql`
- **Dashboard**: Project Settings > Database > Backups

### Railway
- **Automatic backups**: Daily on Hobby plan and above
- **Manual backup**: `railway backup` or `pg_dump $DATABASE_URL > backup.sql`

### Self-hosted PostgreSQL
- **Schedule pg_dump**: Run daily via cron
  ```bash
  0 3 * * * pg_dump $DATABASE_URL | gzip > /backups/rag_$(date +\%Y\%m\%d).sql.gz
  ```
- **Retain 30 days**: `find /backups -name "rag_*.sql.gz" -mtime +30 -delete`

## File Storage Backups

### Cloudinary
- Documents stored in Cloudinary are replicated across CDN nodes
- No additional backup needed — Cloudinary manages durability

### Local filesystem (development)
- Documents stored in `./uploads/` are not backed up automatically
- For production, always use Cloudinary or equivalent cloud storage

## Recovery Procedures

### Full Database Recovery (from pg_dump)

```bash
# 1. Create a new database (or use existing)
createdb rag_recovery

# 2. Restore from backup
gunzip -c backup_YYYYMMDD.sql.gz | psql $DATABASE_URL

# 3. Verify restore
npx tsx scripts/backup-verify.ts

# 4. Update DATABASE_URL in your deployment environment
# 5. Redeploy or restart the application
```

### Point-in-Time Recovery (Prisma Postgres)

```bash
# 1. Use Prisma Console to restore to a point in time
#    or restore from a pg_dump backup:
gunzip -c backup_YYYYMMDD.sql.gz | psql $DIRECT_URL

# 2. Update DATABASE_URL / DIRECT_URL in your deployment environment if needed

# 3. Redeploy or restart the application

# 4. Verify data integrity
npx tsx scripts/backup-verify.ts
```

### Partial Recovery (Specific Tables)

```bash
# Restore only the documents and chunks tables
pg_dump -t documents -t document_chunks $SOURCE_DB_URL > partial_backup.sql
psql $TARGET_DB_URL < partial_backup.sql
```

## Verification

Run the backup verification script after any recovery operation:

```bash
npx tsx scripts/backup-verify.ts
```

This checks:
1. Database connectivity
2. Schema integrity (all expected tables exist)
3. Row counts for critical tables
4. pgvector extension and document_chunks table are present
5. Vector index exists and is functional

## Scheduled Verification

Add a weekly Inngest scheduled function or cron job to automate backup verification:

```bash
# Cron example (runs every Sunday at 4 AM)
0 4 * * 0 cd /app && npx tsx scripts/backup-verify.ts >> /var/log/backup-verify.log 2>&1
```

## RTO and RPO Targets

| Metric | Target | Notes |
|--------|--------|-------|
| RPO (Recovery Point Objective) | < 1 hour | With continuous WAL backups |
| RTO (Recovery Time Objective) | < 30 minutes | Full restore + verification |
| Backup frequency | Daily | Automated via provider or cron |
| Verification frequency | Weekly | Automated backup-verify script |

## Escalation

1. **Backup failure**: Check provider status page, verify credentials, retry
2. **Restore failure**: Verify backup file integrity (`gzip -t backup.sql.gz`), check disk space
3. **Data inconsistency**: Contact database provider support, compare with last known good backup
