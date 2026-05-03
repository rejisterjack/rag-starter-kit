# GitHub Actions Workflows

This directory contains comprehensive GitHub Actions workflows for CI/CD automation.

## Workflows

### ci.yml - Continuous Integration
**Triggers**: Push to `main`, Pull requests to `main`

Comprehensive CI pipeline with parallel jobs:
- **Lint (Biome)**: Runs Biome linting and format checking
- **Type Check**: TypeScript type checking with Prisma client generation
- **Test (Vitest)**: Unit and integration tests with PostgreSQL/pgvector service
- **Build**: Production build verification
- **Security Audit**: npm audit for vulnerabilities

**Features**:
- Uses Node.js 20 and pnpm 10
- pnpm dependency caching
- PostgreSQL with pgvector extension for tests
- Coverage reporting support

### e2e.yml - End-to-End Tests
**Triggers**: Pull requests to `main`, Manual workflow dispatch

Full E2E testing with Playwright:
- Sets up PostgreSQL with pgvector service container
- Runs database migrations
- Installs Playwright browsers (Chromium, Firefox, WebKit)
- Runs E2E tests with artifact upload
- Supports testing against deployments via workflow dispatch

**Features**:
- Multi-browser testing support
- Screenshot and video capture on failure
- Test report artifacts (30-day retention)
- Can target specific deployment URLs

### deploy-production.yml - Deploy to Production
**Triggers**: Release published, Manual workflow dispatch

Complete production deployment pipeline:

**Jobs**:
1. **pre-deploy-checks**: Validates CI status before deployment
2. **deploy**: Deploys to Vercel using vercel-action
3. **migrate-database**: Runs Prisma database migrations
4. **health-check**: Verifies deployment health via /api/health endpoint
5. **smoke-tests**: Runs critical path E2E tests
6. **rollback**: Automatic rollback on failure
7. **notify**: Deployment status notifications

**Features**:
- Environment protection with GitHub Environments
- Sequential job dependencies for safety
- Automatic rollback on health check failure
- Health check with retry logic
- Deployment URL capture and reporting

### security-scan.yml - Security Scanning
**Triggers**: Push to `main`, PRs to `main`, Daily schedule (2 AM UTC), Manual dispatch

Comprehensive security scanning:

**Jobs**:
- **npm-audit**: Scans dependencies for vulnerabilities
- **codeql**: GitHub CodeQL static analysis (JavaScript/TypeScript)
- **trivy-scan**: Container and filesystem vulnerability scanning
- **secret-scan**: GitLeaks secret detection
- **dependency-review**: PR dependency review
- **security-summary**: Aggregated security report

**Features**:
- SARIF results uploaded to GitHub Security tab
- Multiple severity levels tracked
- Scheduled daily scans
- Dependency review for PRs
- Secret leak detection

## Required Secrets

Configure these in GitHub repository settings (Settings → Secrets and variables → Actions):

| Secret | Description | Required For |
|--------|-------------|--------------|
| `VERCEL_TOKEN` | Vercel API token | Deployments |
| `VERCEL_ORG_ID` | Vercel organization ID | Deployments |
| `VERCEL_PROJECT_ID` | Vercel project ID | Deployments |
| `DATABASE_URL` | Production database URL | Migrations |
| `DATABASE_URL_NON_POOLING` | Non-pooling database URL | Migrations |
| `E2E_TEST_USER_EMAIL` | Test user email for E2E | E2E Tests |
| `E2E_TEST_USER_PASSWORD` | Test user password for E2E | E2E Tests |
| `GITLEAKS_LICENSE` | GitLeaks license (optional) | Secret scanning |

## Environment Setup

### Vercel Credentials

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Get credentials from project file
cat .vercel/project.json
```

## Workflow Dependencies

```
ci.yml (on PR/push)
    ├── lint
    ├── type-check
    ├── test (needs: lint, type-check)
    ├── build (needs: lint, type-check)
    └── security-audit

e2e.yml (on PR/manual)
    └── e2e (with PostgreSQL service)

deploy-production.yml (on release)
    ├── pre-deploy-checks
    ├── deploy (needs: pre-deploy-checks)
    ├── migrate-database (needs: deploy)
    ├── health-check (needs: deploy, migrate-database)
    ├── smoke-tests (needs: health-check)
    ├── rollback (on failure)
    └── notify (on success)

security-scan.yml (scheduled/on push)
    ├── npm-audit
    ├── codeql
    ├── trivy-scan
    ├── secret-scan
    ├── dependency-review (PR only)
    └── security-summary
```

## Skipping CI

Add these to commit messages to skip workflows:
- `[skip ci]` - Skip all workflows
- `[ci skip]` - Skip all workflows
- `[no ci]` - Skip all workflows

## Best Practices

1. **Always review security scan results** before merging PRs
2. **Monitor the security-scan workflow** for new vulnerabilities
3. **Use environment protection rules** for production deployments
4. **Keep secrets rotated** regularly

## Troubleshooting

### Workflow not triggering
- Check branch name matches `on.push.branches`
- Verify workflow file is valid YAML (`yamllint`)
- Check GitHub Actions is enabled in repository settings

### Vercel deployment fails
- Verify `VERCEL_TOKEN` has correct permissions
- Check `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are correct
- Ensure project is linked to GitHub in Vercel dashboard

### Database migration fails
- Check `DATABASE_URL` is set correctly
- Ensure database is accessible from CI runners
- Review migration logs for specific errors

### Security scan failures
- Review SARIF results in GitHub Security tab
- Update vulnerable dependencies
- Configure `continue-on-error` for non-critical scans if needed
