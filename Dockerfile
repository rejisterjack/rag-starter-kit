# =============================================================================
# Optimized Multi-stage Dockerfile for RAG Starter Kit
# =============================================================================
# Key optimizations:
#   - Standalone output properly used (no full node_modules in production)
#   - Minimal production image with only necessary files
#   - BuildKit cache mounts for pnpm store
# =============================================================================

ARG PNPM_CACHE_ID=rag-pnpm-store

# -----------------------------------------------------------------------------
# Stage 1: development — hot-reload dev image
# -----------------------------------------------------------------------------
FROM node:25-alpine AS development
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only dependency files first for caching
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install dependencies with cache mount
RUN --mount=type=cache,id=${PNPM_CACHE_ID},target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm db:generate

EXPOSE 3000 5555

CMD ["pnpm", "dev"]

# -----------------------------------------------------------------------------
# Stage 2: deps — production dependencies only
# -----------------------------------------------------------------------------
FROM node:25-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install production dependencies only
RUN --mount=type=cache,id=${PNPM_CACHE_ID},target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# -----------------------------------------------------------------------------
# Stage 3: builder — compile the Next.js application
# -----------------------------------------------------------------------------
FROM node:25-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy production deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy source
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client
RUN pnpm db:generate

# Build with dummy values for build-time env vars
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    NEXTAUTH_SECRET="build-time-placeholder-secret-32chars!!" \
    pnpm build

# -----------------------------------------------------------------------------
# Stage 4: runner — minimal production image
# -----------------------------------------------------------------------------
FROM node:25-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only the standalone output - NO full node_modules!
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy only Prisma files needed for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

# Copy only the Prisma CLI and required binaries (not full dev deps)
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use shell form to run migrations then start
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node server.js"]
