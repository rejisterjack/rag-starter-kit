# Production Deployment Checklist

This checklist covers all the steps required to deploy the RAG Starter Kit to production safely.

## Pre-Deployment

### Environment Variables

- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Generate secure `NEXTAUTH_SECRET` (use `openssl rand -base64 32`)
- [ ] Configure database connection strings
- [ ] Add OpenAI API key
- [ ] Configure OAuth providers (GitHub/Google)
- [ ] Set up Redis/Upstash for rate limiting (recommended)
- [ ] Configure Sentry DSN for error tracking
- [ ] Add PostHog keys for analytics (optional)
- [ ] Set up S3 credentials for file storage (optional)

### Database Setup

- [ ] Provision PostgreSQL 16+ with pgvector extension
- [ ] Test database connectivity
- [ ] Run initial migrations: `pnpm db:migrate:prod`
- [ ] Verify vector extension is installed
- [ ] Set up automated backups

### Vercel Configuration

- [ ] Create Vercel project
- [ ] Link GitHub repository
- [ ] Add environment variables in Vercel dashboard
- [ ] Configure production domain
- [ ] Set up preview deployment settings
- [ ] Configure build settings (uses `vercel.json`)

### Security

- [ ] Enable HTTPS only
- [ ] Configure CORS origins
- [ ] Set up rate limiting
- [ ] Review API key permissions
- [ ] Enable audit logging
- [ ] Configure CSP headers

## Deployment Steps

### 1. Database Migration

```bash
# Backup database first
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Run migrations in production
pnpm db:migrate:prod
```

- [ ] Backup created successfully
- [ ] Migrations applied without errors
- [ ] Post-migration verification passed

### 2. Deploy Application

```bash
# Deploy to Vercel
vercel --prod
```

Or trigger via GitHub Actions push to `main` branch.

- [ ] Build successful
- [ ] Deployment completed
- [ ] Health check endpoint returns 200

### 3. Post-Deployment Verification

Run these checks immediately after deployment:

```bash
# Test health endpoint
curl https://your-domain.com/api/health

# Expected response:
# {
#   "status": "healthy",
#   "checks": [...],
#   "system": {...}
# }
```

- [ ] Health check returns `healthy` status
- [ ] Database connection working
- [ ] Vector extension enabled
- [ ] OpenAI API accessible

### 4. Smoke Tests

- [ ] User registration works
- [ ] User login works
- [ ] Document upload works
- [ ] Chat functionality works
- [ ] Search returns results

## Post-Deployment

### Monitoring Setup

- [ ] Verify Sentry is receiving errors
- [ ] Check PostHog analytics events
- [ ] Set up log aggregation (Vercel Logs)
- [ ] Configure uptime monitoring
- [ ] Set up alerting thresholds

### Performance Optimization

- [ ] Enable Vercel Analytics
- [ ] Review Core Web Vitals
- [ ] Optimize image delivery
- [ ] Check API response times
- [ ] Monitor database query performance

### Documentation

- [ ] Update deployment documentation
- [ ] Document any custom configuration
- [ ] Share team access credentials
- [ ] Schedule runbook review

## Rollback Plan

In case of issues:

1. **Immediate Rollback**
   ```bash
   # Revert to previous Vercel deployment
   vercel rollback
   ```

2. **Database Rollback** (if needed)
   ```bash
   # Restore from backup
   psql $DATABASE_URL < backup.sql
   ```

3. **Communication**
   - [ ] Notify team of issues
   - [ ] Update status page
   - [ ] Document incident

## Regular Maintenance

### Weekly

- [ ] Review error logs in Sentry
- [ ] Check analytics dashboard
- [ ] Monitor database performance
- [ ] Review security alerts

### Monthly

- [ ] Review and merge Dependabot PRs
- [ ] Check for unused dependencies
- [ ] Review access logs
- [ ] Update documentation

### Quarterly

- [ ] Security audit
- [ ] Dependency major version review
- [ ] Disaster recovery test
- [ ] Performance benchmark

---

## Emergency Contacts

- **Primary On-call**: [Name] - [Phone]
- **Secondary On-call**: [Name] - [Phone]
- **Database Admin**: [Name] - [Phone]
- **Infrastructure**: [Name] - [Phone]

## Useful Commands

```bash
# Check deployment status
vercel ls

# View logs
vercel logs --all

# Database status
pnpm prisma studio

# Create backup
# Upload to S3
aws s3 cp backup.sql s3://your-bucket/backups/

# Run health check
curl https://your-domain.com/api/health
```
