# Contributing to rag-starter-kit

First — thank you. Every bug report, typo fix, and feature contribution makes this better for everyone.

This guide covers everything you need to go from "I want to contribute" to "my PR is merged."

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Setting Up Locally](#setting-up-locally)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Commit Conventions](#commit-conventions)
- [Code Style](#code-style)
- [Testing](#testing)
- [What to Work On](#what-to-work-on)
- [What We Won't Accept](#what-we-wont-accept)

---

## Before You Start

For small changes (typo fixes, documentation improvements, minor bug fixes) — just open a PR directly. No need to ask first.

For larger changes (new features, architectural decisions, breaking changes) — open an issue first and describe what you want to build. This saves you from spending time on something that won't be merged. We'll discuss the approach before you write any code.

---

## Setting Up Locally

### Prerequisites

- **Node.js 20+**
- **pnpm 9+** — install with `npm install -g pnpm`
- **Docker & Docker Compose** — required to run Postgres, Redis, and MinIO locally

### Steps

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/rag-starter-kit.git
cd rag-starter-kit

# 2. Install dependencies
pnpm install

# 3. Copy the environment template
cp .env.example .env

# 4. Add your free API keys to .env
# - OpenRouter (free): https://openrouter.ai/keys
# - Google AI Studio (free): https://aistudio.google.com/app/apikey

# 5. Start all services
docker compose up

# 6. Open http://localhost:3000
```

The Docker stack starts: Next.js app, PostgreSQL + pgvector, Redis, MinIO, and the Inngest dev server. Everything runs locally — no external services needed beyond the two free API keys.

### Verify Everything Works

```bash
pnpm test          # Unit tests should pass
pnpm test:e2e      # E2E tests (requires the Docker stack running)
```

If either of these fails on a clean clone, that's a bug — please open an issue.

---

## Project Structure

```
rag-starter-kit/
├── src/
│   ├── app/                 # Next.js 15 App Router pages and layouts
│   ├── components/          # Reusable React components (shadcn/ui based)
│   ├── lib/
│   │   ├── ai/             # LLM provider config (OpenRouter + Gemini)
│   │   ├── db/             # Prisma client and database utilities
│   │   ├── rag/            # RAG pipeline — chunking, embedding, retrieval
│   │   ├── auth/           # NextAuth.js v5 configuration
│   │   └── realtime/       # WebSocket / SSE logic
│   └── hooks/              # Custom React hooks
├── prisma/                 # Database schema and migrations
├── tests/                  # Vitest unit tests and Playwright E2E tests
├── docker-compose.yml      # Full local development stack
└── .github/workflows/      # CI/CD pipelines
```

When adding a new feature, follow the existing pattern for where things live. If you're unsure, ask in the issue before writing code.

---

## Development Workflow

### Adding a Feature

```bash
# 1. Create a branch from main
git checkout -b feat/your-feature-name

# 2. Make your changes

# 3. Run tests
pnpm test
pnpm test:e2e

# 4. Run the linter
pnpm lint

# 5. Commit your changes (see commit conventions below)
git commit -m "feat: add multi-LLM provider switching"

# 6. Push and open a PR
git push origin feat/your-feature-name
```

### Making a Database Change

If your change requires a schema update:

```bash
# 1. Edit prisma/schema.prisma

# 2. Generate and apply the migration
pnpm prisma migrate dev --name describe-your-change

# 3. Regenerate the Prisma client
pnpm prisma generate
```

Always include migrations in your PR. Never ask reviewers to run raw SQL.

### Adding a New Environment Variable

If your feature requires a new env var:

1. Add it to `.env.example` with a comment explaining what it does, its type, its default value, and where to get it if it's an external key
2. Add validation for it in the startup config check
3. Document it in the README's environment variables table

---

## Submitting a Pull Request

A good PR has:

**A clear title** that matches the commit convention — `feat: add admin dashboard` not `updates` or `fix stuff`.

**A description** that explains:
- What problem does this solve?
- What does the implementation look like at a high level?
- Are there any trade-offs or known limitations?
- How to test it manually?

**Tests** — new features need tests. Bug fixes should include a test that would have caught the bug.

**No unrelated changes** — keep PRs focused. If you spot something unrelated that needs fixing, open a separate PR for it.

**A clean commit history** — squash work-in-progress commits before requesting review. `fix typo` and `oops` commits shouldn't be in the final PR.

### PR Template

```markdown
## What does this do?
Brief description of the change.

## Why?
The problem it solves or the value it adds.

## How to test
Step-by-step instructions to verify this works manually.

## Screenshots (if UI change)
Before / after.

## Checklist
- [ ] Tests added or updated
- [ ] .env.example updated (if new env vars)
- [ ] README updated (if new feature)
- [ ] CHANGELOG.md updated
```

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). This is enforced by the CI — non-conforming commits will fail the check.

| Prefix | When to use |
|--------|------------|
| `feat:` | A new feature |
| `fix:` | A bug fix |
| `docs:` | Documentation only changes |
| `style:` | Formatting changes (no logic change) |
| `refactor:` | Code restructuring (no feature or fix) |
| `test:` | Adding or updating tests |
| `chore:` | Build process, dependency updates, tooling |
| `perf:` | Performance improvements |

**Examples:**
```
feat: add Anthropic Claude provider support
fix: prevent duplicate document ingestion
docs: add troubleshooting section to README
refactor: extract retrieval logic into standalone service
test: add E2E tests for document upload flow
chore: update Prisma to v7.1
```

Breaking changes: add `!` after the prefix and describe what breaks in the commit body.
```
feat!: rename OPENAI_API_KEY to LLM_API_KEY

BREAKING CHANGE: The environment variable for the LLM API key has been renamed.
Update your .env file before upgrading.
```

---

## Code Style

We use [Biome](https://biomejs.dev/) for formatting and linting. It runs automatically on commit via a pre-commit hook.

```bash
pnpm lint          # Check for issues
pnpm lint:fix      # Auto-fix what can be fixed
pnpm format        # Format all files
```

Key conventions:
- TypeScript strict mode — no `any` without a comment explaining why
- No `console.log` in production code — use the logger utility
- Async/await over `.then()` chains
- Named exports over default exports (except for Next.js pages and API routes)
- Co-locate types with the code that uses them — no giant `types.ts` files

---

## Testing

### Unit Tests (Vitest)

```bash
pnpm test                  # Run all unit tests
pnpm test:watch            # Watch mode
pnpm test:coverage         # Coverage report
```

Unit tests live alongside the code they test: `src/lib/rag/chunker.ts` → `src/lib/rag/chunker.test.ts`.

### E2E Tests (Playwright)

```bash
pnpm test:e2e              # Run all E2E tests (requires Docker stack)
pnpm test:e2e --ui         # Open Playwright UI
```

E2E tests live in `tests/e2e/`. They test full user flows — document upload, chat, authentication.

### What Needs Tests

- **New utility functions** — unit test every public function
- **New API routes** — integration test with a real database (use the test Docker setup)
- **New UI flows** — E2E test the happy path at minimum
- **Bug fixes** — add a test that would have caught the bug

---

## What to Work On

Check the [ROADMAP.md](./ROADMAP.md) for the planned feature list. Items marked `📋 Planned` are open for contribution.

The best first contributions are:
- Fixing a bug listed in [Issues](../../issues) with the `good first issue` label
- Improving documentation or adding missing docstrings
- Adding test coverage to untested code
- Fixing a failing CI check

For features marked `💡 Idea` in the roadmap — open an issue first to discuss the approach before building anything.

---

## What We Won't Accept

To keep the project focused, these types of contributions will be declined:

- **Python code of any kind** — this is a TypeScript project
- **No-code or visual builder UI** — always code-first
- **Paid API as default** — the default config must remain free to run
- **New dependencies without clear justification** — every new package has a cost; explain why it's needed
- **Features not in the roadmap without prior discussion** — open an issue first

---

## Questions?

Open a [GitHub Discussion](../../discussions) if you have a question about the codebase, the architecture, or how to approach something. Issues are for bugs and feature requests. Discussions are for everything else.

---

*Thanks for contributing. Every PR, no matter how small, makes this better.*
