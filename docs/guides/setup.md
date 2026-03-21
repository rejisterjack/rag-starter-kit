# Development Setup Guide

Complete guide to setting up the RAG Starter Kit for local development.

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 20.x | [nodejs.org](https://nodejs.org/) |
| pnpm | 9.x | `npm install -g pnpm` |
| Docker | Latest | [docker.com](https://docker.com/) |
| Git | Latest | [git-scm.com](https://git-scm.com/) |

### Verify Installation

```bash
# Check versions
node --version    # v20.x.x
pnpm --version    # 9.x.x
docker --version  # 24.x.x
docker-compose --version  # 2.x.x
```

## Quick Start (Docker - Recommended)

### 1. Clone Repository

```bash
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env  # or use your preferred editor
```

### 3. Get Free API Keys

#### OpenRouter (for Chat)

1. Visit [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create an account (free)
3. Generate an API key
4. Add to `.env`:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

#### Google AI Studio (for Embeddings)

1. Visit [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with Google account
3. Create new API key
4. Add to `.env`:
   ```bash
   GOOGLE_API_KEY=AIzaSy...
   ```

#### NextAuth Secret

```bash
# Generate random secret
openssl rand -base64 32

# Add to .env
NEXTAUTH_SECRET=your-generated-secret
```

### 4. Start Development Environment

```bash
# Start all services
docker-compose up

# Or in detached mode
docker-compose up -d
```

### 5. Access Services

| Service | URL | Notes |
|---------|-----|-------|
| Application | http://localhost:3000 | Main Next.js app |
| Prisma Studio | http://localhost:5555 | Database GUI |
| Inngest Dashboard | http://localhost:8288 | Background jobs |
| MinIO Console | http://localhost:9001 | S3 storage (minioadmin/minioadmin) |
| Plausible | http://localhost:8000 | Analytics |

### 6. Initialize Database

```bash
# In a new terminal
docker-compose exec app pnpm db:migrate

# (Optional) Seed with sample data
docker-compose exec app pnpm db:seed
```

## Manual Setup (Without Docker)

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu:**
```bash
sudo apt-get install postgresql-16 postgresql-contrib
sudo systemctl start postgresql
```

**Enable pgvector:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Enable extension
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 2. Install Redis

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis
```

### 3. Install MinIO (Optional)

```bash
# macOS
brew install minio
minio server ~/minio-data

# Or use AWS S3 with local credentials
```

### 4. Install Dependencies

```bash
pnpm install
```

### 5. Configure Environment

```bash
cp .env.example .env

# Edit database URL
DATABASE_URL="postgresql://postgres:password@localhost:5432/rag_starter_kit"

# Add other required variables
```

### 6. Run Database Migrations

```bash
pnpm db:migrate
```

### 7. Start Development Server

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Inngest dev server
pnpm inngest:dev

# Terminal 3: WebSocket server (if using real-time features)
pnpm dev:ws
```

## IDE Setup

### VS Code (Recommended)

Install extensions (see `.vscode/extensions.json`):

```bash
code --install-extension biomejs.biome
code --install-extension prisma.prisma
code --install-extension bradlc.vscode-tailwindcss
```

### Recommended Settings

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

## Project Structure

```
rag-starter-kit/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   ├── chat/         # Chat pages
│   │   └── layout.tsx    # Root layout
│   ├── components/       # React components
│   │   └── ui/           # shadcn/ui components
│   ├── lib/              # Utility libraries
│   │   ├── ai/           # AI providers
│   │   ├── auth/         # Authentication
│   │   ├── db/           # Database client
│   │   ├── rag/          # RAG pipeline
│   │   └── security/     # Security utilities
│   └── hooks/            # Custom React hooks
├── prisma/               # Database schema
├── tests/                # Test files
├── docs/                 # Documentation
└── docker-compose.yml    # Docker configuration
```

## Development Workflow

### Running Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# All tests
pnpm test:all
```

### Code Quality

```bash
# Lint
pnpm lint

# Format
pnpm format

# Type check
pnpm type-check

# Check all
pnpm check
```

### Database Operations

```bash
# Generate Prisma client
pnpm db:generate

# Create migration
pnpm db:migrate

# Open Prisma Studio
pnpm db:studio

# Seed database
pnpm db:seed
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
pnpm check:fix  # Auto-fix issues
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/my-feature
```

## Troubleshooting

### Common Issues

#### "Cannot find module" errors

```bash
# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Database connection errors

```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string in .env
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

#### Port already in use

```bash
# Find process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
pnpm dev --port 3001
```

#### Docker issues

```bash
# Clean restart
docker-compose down -v
docker-compose up --build

# Check logs
docker-compose logs -f app
```

### Getting Help

- Check [Troubleshooting](./troubleshooting.md)
- Review [GitHub Issues](https://github.com/rejisterjack/rag-starter-kit/issues)
- Join our [Discord](https://discord.gg/rag-starter-kit)

## Next Steps

- Read [Architecture Overview](../architecture.md)
- Learn about [Adding New Models](./adding-new-models.md)
- Explore [Customizing the UI](./customizing-ui.md)
- Deploy with [Deployment Guide](./deploying.md)
