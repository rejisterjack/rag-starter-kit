# 🆓 Best Free AI Setup Guide

This guide explains the **completely free** AI configuration for RAG Starter Kit using:
- **Chat**: OpenRouter (free models with automatic fallback)
- **Embeddings**: Google AI Studio (Gemini - free tier)

---

## 🎯 Quick Start

### 1. Get API Keys (Both FREE)

| Service | Purpose | Get Key | Free Tier |
|---------|---------|---------|-----------|
| **OpenRouter** | Chat/LLM | [openrouter.ai/keys](https://openrouter.ai/keys) | Unlimited requests, rate limited |
| **Google AI Studio** | Embeddings | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | 1,500 requests/day |

### 2. Configure Environment

```bash
# .env.local or .env.docker

# 🔴 REQUIRED: OpenRouter (Chat)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# 🟡 REQUIRED: Google AI Studio (Embeddings)
GOOGLE_API_KEY=your-google-ai-studio-key

# Optional: Auto-configured defaults
LLM_PROVIDER=openrouter
EMBEDDING_PROVIDER=google
DEFAULT_MODEL=deepseek/deepseek-chat:free
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
```

### 3. Update Database (if migrating from OpenAI)

```bash
# If you previously used OpenAI embeddings (1536 dims)
# You need to reset the vector column for 768 dimensions

# Option 1: Reset everything
pnpm db:reset

# Option 2: Migration (production)
# See "Migrating Embedding Dimensions" below
```

---

## 🏆 Best Free Models (Ranked)

### Chat Models (OpenRouter - FREE)

| Rank | Model | Strengths | Speed |
|------|-------|-----------|-------|
| 🥇 | `deepseek/deepseek-chat:free` | Excellent reasoning, coding | Fast |
| 🥈 | `mistralai/mistral-7b-instruct:free` | Reliable, balanced | Very Fast |
| 🥈 | `meta-llama/llama-3.1-8b-instruct:free` | Great performance | Fast |
| 🥉 | `google/gemma-2-9b-it:free` | Good quality | Fast |
| 🥉 | `qwen/qwen-2.5-7b-instruct:free` | Strong multilingual | Fast |
| 🏅 | `nousresearch/hermes-3-llama-3.1-405b:free` | Most capable | Slow |

### Embedding Models (Google AI Studio - FREE)

| Model | Dimensions | Quality | Rate Limit |
|-------|------------|---------|------------|
| `text-embedding-004` | 768 | ⭐⭐⭐⭐⭐ | 1,500/day |
| `embedding-001` | 768 | ⭐⭐⭐⭐ | 1,500/day |

---

## ⚙️ Configuration Options

### Automatic Model Fallback

The app automatically tries multiple models if the primary fails:

```typescript
// Fallback chain (tried in order):
1. deepseek/deepseek-chat:free     (primary)
2. mistralai/mistral-7b-instruct:free
3. meta-llama/llama-3.1-8b-instruct:free
4. google/gemma-2-9b-it:free
5. qwen/qwen-2.5-7b-instruct:free
```

### Custom Model Selection

```bash
# Use a specific model
DEFAULT_MODEL=mistralai/mistral-7b-instruct:free

# Or use the experimental 405B model (slower but powerful)
DEFAULT_MODEL=nousresearch/hermes-3-llama-3.1-405b:free
```

---

## 🐳 Docker Setup

```bash
# 1. Add your API keys to .env.docker
OPENROUTER_API_KEY=sk-or-v1-your-key
GOOGLE_API_KEY=your-google-key

# 2. Start services
docker-compose -f docker-compose.dev.yml up

# 3. Access app at http://localhost:3000
```

---

## 📊 Rate Limits

### OpenRouter (Free)
- **Requests**: Unlimited
- **Rate**: ~20 requests/minute (varies by model)
- **Daily**: No hard limit

### Google AI Studio (Free)
- **Requests**: 1,500/day
- **Rate**: 100 requests/minute
- **Per-minute**: 100 embed requests

---

## 🔄 Migrating Embedding Dimensions

If you're switching from OpenAI (1536 dims) to Google (768 dims):

### Option 1: Fresh Start (Development)

```bash
# Reset database
pnpm db:reset

# Or with Docker
docker-compose down -v
docker-compose up
```

### Option 2: Migration (Production)

```sql
-- Backup existing embeddings
CREATE TABLE document_chunk_backup AS SELECT * FROM "DocumentChunk";

-- Drop embedding column
ALTER TABLE "DocumentChunk" DROP COLUMN embedding;

-- Add new column with 768 dimensions
ALTER TABLE "DocumentChunk" ADD COLUMN embedding vector(768);

-- Recreate index
DROP INDEX IF EXISTS idx_document_chunk_embedding_hnsw;
CREATE INDEX idx_document_chunk_embedding_hnsw 
ON "DocumentChunk" 
USING hnsw (embedding vector_cosine_ops);

-- Re-embed all documents (run through app or script)
```

---

## 🧪 Testing Your Setup

```bash
# Test OpenRouter
curl https://openrouter.ai/api/v1/auth/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Test Google AI Studio
node -e "
const { google } = require('@ai-sdk/google');
console.log('Google provider loaded:', !!google);
"
```

---

## 🚨 Troubleshooting

### "Invalid API key" errors
- OpenRouter: Check key at [openrouter.ai/keys](https://openrouter.ai/keys)
- Google: Create new key at [AI Studio](https://aistudio.google.com/app/apikey)

### "Dimension mismatch" errors
- Database needs migration (see above)
- Ensure `EMBEDDING_DIMENSIONS=768` matches schema

### Rate limit errors
- OpenRouter: Wait a minute, retry
- Google: Max 1,500/day - check usage at AI Studio

### Model unavailable
- Automatic fallback should handle this
- Check [OpenRouter status](https://status.openrouter.ai/)

---

## 💡 Pro Tips

1. **Use DeepSeek as primary** - Best reasoning of free models
2. **Monitor Google quota** - 1,500 embeddings/day is plenty for most use cases
3. **Enable fallback chain** - Ensures uptime even if one model is down
4. **Cache embeddings** - Reuse embeddings to save quota

---

## 📚 Resources

- [OpenRouter Free Models](https://openrouter.ai/models?max_price=0)
- [Google AI Studio Pricing](https://ai.google.dev/pricing)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [Gemini Embedding Docs](https://ai.google.dev/gemini-api/docs/embeddings)
