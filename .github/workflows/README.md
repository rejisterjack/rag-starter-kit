# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD.

## Workflows

### ci.yml
**Trigger**: Pull requests to `main`/`develop`, pushes to `main`

Runs on every PR:
- **Lint**: ESLint, TypeScript type check, Prettier
- **Test**: Unit tests with coverage (uses pgvector/pgvector:pg16)
- **Build**: Production build verification
- **Security**: `npm audit` for vulnerabilities

### e2e.yml
**Trigger**: Deployment status changes, manual dispatch

Runs E2E tests after successful deployment:
- Installs Playwright browsers
- Runs tests against deployed URL
- Uploads screenshots on failure

### deploy-production.yml
**Trigger**: Push to `main`, manual dispatch

Production deployment pipeline:
- Deploys to Vercel
- Runs database migrations
- Performs health checks
- Sends notifications

### preview.yml
**Trigger**: Pull request events

Creates preview deployments:
- Deploys to Vercel preview environment
- Comments PR with preview URL
- Runs smoke tests

## Required Secrets

Configure in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `DATABASE_URL` | Production database URL |
| `E2E_TEST_USER_EMAIL` | Test user email for E2E |
| `E2E_TEST_USER_PASSWORD` | Test user password for E2E |

## Getting Vercel Credentials

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Get credentials
cat .vercel/project.json
```

## Skipping CI

Add to commit message to skip:
- `[skip ci]` - Skip all workflows
- `[ci skip]` - Skip all workflows
- `[no ci]` - Skip all workflows

## Troubleshooting

### Workflow not triggering
- Check branch name matches `on.push.branches`
- Verify workflow file is valid YAML
- Check GitHub Actions is enabled in repository settings

### Vercel deployment fails
- Verify `VERCEL_TOKEN` has correct permissions
- Check `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are correct
- Ensure project is linked to GitHub in Vercel dashboard

### Database migration fails
- Check `DATABASE_URL` is set correctly
- Ensure database is accessible from CI runners
- Review migration logs for specific errors
