# Environment Variables

## 📁 Files

| File | Purpose | Git |
|------|---------|-----|
| `.env.example` | Template with all options | ✅ Tracked |
| `.env` | Your actual configuration | ❌ Ignored |

## 🚀 Quick Start

```bash
# Copy the template
cp .env.example .env

# Edit with your API keys
# - OPENROUTER_API_KEY from https://openrouter.ai/keys
# - GOOGLE_API_KEY from https://aistudio.google.com/app/apikey
# - Generate NEXTAUTH_SECRET: openssl rand -base64 32

# Start the stack
docker-compose up
```

## 🔑 Required Variables

| Variable | Source | Free Tier |
|----------|--------|-----------|
| `OPENROUTER_API_KEY` | [OpenRouter](https://openrouter.ai/keys) | Unlimited |
| `GOOGLE_API_KEY` | [AI Studio](https://aistudio.google.com/app/apikey) | 1,500/day |
| `NEXTAUTH_SECRET` | Generate locally | - |

Generate secret:
```bash
openssl rand -base64 32
```

## 📊 By Category

### AI Providers
```env
OPENROUTER_API_KEY=sk-or-v1-xxx
GOOGLE_API_KEY=xxx
```

### Database (PostgreSQL)
```env
# Uses Docker service name
DATABASE_URL=postgresql://postgres:postgres@rag-db:5432/ragdb
```

### Auth
```env
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000
```

### Storage (MinIO)
```env
S3_ENDPOINT=http://rag-minio:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

### Redis
```env
REDIS_URL=redis://rag-redis:6379
```

### Analytics (Plausible)
```env
NEXT_PUBLIC_ANALYTICS_HOST=http://localhost:8000
NEXT_PUBLIC_ANALYTICS_SCRIPT_URL=http://localhost:8000/js/script.js
```

## 🐛 Troubleshooting

### "Missing environment variable"
```bash
# Check .env exists
ls -la .env

# Copy from example if missing
cp .env.example .env
```

### "Invalid API key"
- Verify keys at [OpenRouter](https://openrouter.ai/keys) and [Google AI](https://aistudio.google.com/app/apikey)
- Check for extra spaces in .env file

### "Database connection failed"
```bash
# Check services are running
docker-compose ps

# Check database logs
docker-compose logs db
```

## 🔒 Security

- **Never commit `.env`** - It's gitignored
- **Use different secrets** for dev vs production
- **Rotate API keys** periodically
- **Monitor usage** on OpenRouter/Google dashboards
