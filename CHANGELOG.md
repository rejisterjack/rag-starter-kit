# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Docker build optimization with BuildKit cache mounts
- Complete removal of Sentry integration for faster builds
- New homepage UI with modern design, animations, and responsive layout
- User authentication status in navbar with sign in/out functionality
- Test helper utilities (`tests/utils/helpers/setup.ts`)
- Prisma mock for testing (`tests/utils/mocks/prisma.ts`)
- OCR stub module for future PDF processing features
- This CHANGELOG.md file

### Changed
- Renamed route group folder from `(chat)` to `chat` for better Docker compatibility
- Optimized `.dockerignore` for smaller build context
- Improved Dockerfile with proper standalone output
- Updated auth pages to remove OAuth buttons when credentials not configured
- Added `suppressHydrationWarning` to prevent browser extension warnings

### Fixed
- Fixed Docker build times (from 15+ min to ~3 min)
- Fixed missing database tables (RateLimit model)
- Fixed hydration mismatch warnings from browser extensions
- Fixed chat page 404 error in Docker environment
- Fixed TypeScript errors in unused imports
- Fixed missing logger import in email service
- Fixed middleware TypeScript type error

### Removed
- Sentry integration completely removed
- Sentry client, server, and edge config files
- `@sentry/nextjs` dependency
- `src/lib/observability/sentry.ts` module

## [1.0.0] - 2024-01-01

### Added
- Initial release of RAG Starter Kit
- Next.js 15 App Router with React 19
- PostgreSQL 16 with pgvector extension
- Prisma 7 with `@prisma/adapter-pg`
- NextAuth.js v5 authentication with GitHub/Google OAuth
- Document upload and processing (PDF, DOCX, TXT)
- Real-time chat with streaming responses
- LangChain integration for RAG pipeline
- Inngest background job processing
- MinIO S3-compatible object storage
- Docker Compose setup for development and production
- Tailwind CSS 4 with shadcn/ui components
- PWA support with service workers
- Voice input/output capabilities
- Real-time collaboration features
- Workspace management with role-based access
- Audit logging for security
- Rate limiting with Upstash Redis
- CI/CD pipelines with GitHub Actions
- Comprehensive test setup with Vitest and Playwright

### Security
- Row-level data isolation via userId/workspaceId
- Input validation with Zod
- API route protection with session checks
- Secure credential storage
- TypeScript strict mode throughout
