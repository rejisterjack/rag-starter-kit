# Scripts Directory

This directory contains utility scripts for the RAG Starter Kit.

## Available Scripts

### setup-env.sh
Interactive script to set up environment variables for development or production.

```bash
./scripts/setup-env.sh [development|production]
```

**Features:**
- Generates secure random secrets
- Creates environment files from templates
- Validates required variables
- Interactive configuration mode

### migrate.sh
Production-safe database migration script.

```bash
./scripts/migrate.sh [--dry-run] [--force] [--backup]
```

**Features:**
- Pre-migration database connection check
- Automatic pgvector extension verification
- Optional backup before migration
- Post-migration verification
- Dry-run mode for testing

**Options:**
- `--dry-run` - Preview migrations without applying
- `--force` - Skip confirmation prompts
- `--backup` - Create backup before migration

### backup.sh
Database backup script with optional S3 upload.

```bash
./scripts/backup.sh [--s3] [--bucket NAME] [--retention DAYS]
```

**Features:**
- Compressed backups (gzip)
- Automatic cleanup of old backups
- S3 upload support
- Integrity verification
- Cron-friendly output

**Options:**
- `--s3` - Upload backup to S3
- `--bucket NAME` - S3 bucket name
- `--prefix PATH` - S3 prefix/path
- `--retention DAYS` - Local retention period

**Environment Variables:**
- `DATABASE_URL` or `POSTGRES_URL_NON_POOLING` - Database connection
- `BACKUP_BUCKET` - Default S3 bucket
- `SLACK_WEBHOOK_URL` - Notify Slack on completion
- `DISCORD_WEBHOOK_URL` - Notify Discord on completion

## Usage Examples

### Development Setup

```bash
# Set up development environment
./scripts/setup-env.sh development

# Configure interactively
./scripts/setup-env.sh development
# Then answer prompts for OpenAI key, database, etc.
```

### Production Deployment

```bash
# Set up production environment
./scripts/setup-env.sh production

# Run migrations with backup
./scripts/migrate.sh --backup

# Create manual backup
./scripts/backup.sh --s3 --bucket my-backups
```

### Automated Backups (Cron)

Add to crontab for daily backups:

```bash
# Edit crontab
crontab -e

# Add line for daily backup at 2 AM
0 2 * * * /path/to/rag-starter-kit/scripts/backup.sh --s3 --bucket my-backups >> /var/log/rag-backup.log 2>&1
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Missing prerequisites |
| 3 | Database connection failed |
| 4 | Migration failed |
| 5 | Backup failed |

## Requirements

- Node.js 20+
- pnpm
- PostgreSQL client tools (`pg_dump`, `psql`)
- openssl (for generating secrets)
- AWS CLI (optional, for S3 uploads)
