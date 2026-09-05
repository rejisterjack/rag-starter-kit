# Deploying to Vercel (Hobby Plan)

This guide walks you through deploying the RAG Starter Kit to Vercel's free Hobby plan using exclusively managed services.

## Architecture

```
Vercel Hobby (Serverless Functions, 10s timeout)
├── Prisma Postgres (Accelerate) + pgvector
├── Upstash Redis (free tier, caching + rate limiting)
├── Cloudinary (free tier, file storage)
├── Inngest Cloud (free tier, background jobs)
├── Google Gemini (free tier, embeddings)
├── OpenRouter (free models, LLM)
└── Sentry (free tier, error tracking)
```

All components are managed services with free tiers. No Docker, containers, or self-hosted infrastructure required.

## Prerequisites

- A [Vercel](https://vercel.com) account
- A [GitHub](https://github.com) account
- 10 minutes

## Step 1: Set Up Managed Services

### 1a. Prisma Postgres (Accelerate)

1. Go to [console.prisma.io](https://console.prisma.io) and create a new project with a Postgres database
2. Name it `rag-starter-kit`
3. Copy the **Accelerate connection string** (starts with `prisma+postgres://`)
4. Save it as `DATABASE_URL`
5. Copy the **direct connection string** and save it as `DIRECT_URL`

### 1b. Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com) and create a free Redis database
2. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 1c. OpenRouter (LLM)

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys) and create a free API key
2. Save it as `OPENROUTER_API_KEY`

### 1d. Google Gemini (Embeddings)

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and create a free API key
2. Save it as `GOOGLE_GENERATIVE_AI_API_KEY`

### 1e. Cloudinary (File Storage)

1. Go to [cloudinary.com](https://cloudinary.com/users/register_free) and create a free account
2. Find your credentials at [console.cloudinary.com/settings/api-keys](https://console.cloudinary.com/settings/api-keys)
3. Save `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 1f. Inngest (Background Jobs)

1. Go to [inngest.com](https://www.inngest.com) and create a free account
2. Create a new app and copy the `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`

## Step 2: Deploy to Vercel

### Option A: One-Click Deploy (Recommended)

1. Fork the repository on GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your forked repository
4. Vercel will detect Next.js automatically
5. Add all environment variables (see below)
6. Click **Deploy**

### Option B: Vercel CLI

```bash
# Install Vercel CLI
bun i -g vercel

# Login
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL
vercel env add OPENROUTER_API_KEY
vercel env add GOOGLE_GENERATIVE_AI_API_KEY
vercel env add NEXTAUTH_SECRET
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add INNGEST_SIGNING_KEY
vercel env add INNGEST_EVENT_KEY
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
# ... add other optional variables as needed

# Deploy
vercel --prod
```

## Step 3: Run Database Migrations

After the first deployment, run migrations to create the database tables:

```bash
# Pull env vars locally
vercel env pull .env.local

# Run migrations
bun db:migrate:prod
```

## Step 4: Connect Inngest

1. Go to your Inngest dashboard
2. Add a sync endpoint: `https://your-app.vercel.app/api/inngest`
3. Inngest will discover all background jobs automatically

## Step 5: Verify

1. Visit your deployed URL
2. Register a new account
3. Upload a document (PDF, DOCX, or TXT)
4. Ask a question about the document
5. Check the Inngest dashboard for job status

## Environment Variables Reference

### Required (Free Tier)

| Variable | Source | Free Tier |
|----------|--------|-----------|
| `DATABASE_URL` | Prisma Postgres (Accelerate) | 0.5GB storage |
| `OPENROUTER_API_KEY` | OpenRouter | Free models |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio | 1,500 req/day |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` | - |

### Strongly Recommended

| Variable | Source | Free Tier |
|----------|--------|-----------|
| `UPSTASH_REDIS_REST_URL` | Upstash | 10K commands/day |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | - |
| `INNGEST_SIGNING_KEY` | Inngest | 50K events/month |
| `INNGEST_EVENT_KEY` | Inngest | - |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | 25GB storage |
| `CLOUDINARY_API_KEY` | Cloudinary | - |
| `CLOUDINARY_API_SECRET` | Cloudinary | - |

### Optional

| Variable | Source | Purpose |
|----------|--------|---------|
| `SENTRY_DSN` | Sentry | Error tracking |
| `CRON_SECRET` | Generate: `openssl rand -base64 32` | Secures cleanup cron |

## Hobby Plan Limits

| Resource | Limit |
|----------|-------|
| Function timeout | 10 seconds |
| Bandwidth | 100 GB/month |
| Concurrent executions | Limited |
| Cron jobs | 1 (2 on Pro) |

The app is optimized for these limits:
- AI calls timeout at 8 seconds (2s buffer)
- Heavy modules are lazy-loaded to reduce cold starts
- Rate limiting falls back to database when Redis is unavailable
- Cleanup runs via Vercel Cron at 3 AM UTC daily
