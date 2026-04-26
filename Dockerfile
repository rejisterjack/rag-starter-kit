# =============================================================================
# Hyper-Optimized Multi-Stage Dockerfile for RAG Starter Kit
# =============================================================================
# Build-time dependencies are NEVER included in the final image.
# Final runtime image: node:20-alpine + .next/standalone only (~200MB target)
#
# Stages:
#   1. base        — shared Alpine config & pnpm bootstrap
#   2. deps        — production-only node_modules (cache-mounted)
#   3. builder     — full build + Prisma client generation
#   4. runner      — minimal production runtime (no build tools)
# =============================================================================

ARG NODE_VERSION=20
ARG PNPM_VERSION=10
ARG PNPM_CACHE_ID=rag-pnpm-store

# -----------------------------------------------------------------------------
# Stage 1: base — shared Alpine + pnpm bootstrap (reused by all stages)
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base

# Install ONLY the minimal native libraries required at runtime by:
#   - openssl  → Prisma engine TLS
#   - libc6-compat → glibc-musl compatibility shim for native binaries
# Clean cache in the same layer to prevent bloat
RUN apk add --no-cache libc6-compat openssl \
    && rm -rf /var/cache/apk/* /tmp/*

# Enable corepack and activate pnpm without downloading extras
RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: deps — production-only dependencies (no devDeps, no scripts)
# -----------------------------------------------------------------------------
FROM base AS deps

ARG PNPM_CACHE_ID

# Copy only the files that define the dependency graph
# (changes to src code won't invalidate this cache layer)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install production deps only, using BuildKit cache mounts so
# the pnpm content-addressable store persists between builds.
# --ignore-scripts skips lifecycle hooks (postinstall runs generate separately).
RUN --mount=type=cache,id=${PNPM_CACHE_ID},target=/root/.local/share/pnpm/store \
    pnpm install \
      --frozen-lockfile \
      --prod \
      --ignore-scripts \
    && rm -rf /root/.local/share/pnpm/store/v3/tmp

# Generate Prisma client against production deps
RUN pnpm db:generate

# -----------------------------------------------------------------------------
# Stage 3: builder — full dependency install + Next.js build
# -----------------------------------------------------------------------------
FROM base AS builder

ARG PNPM_CACHE_ID

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

# Dependency files first — maximizes layer cache reuse across src changes
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install ALL deps (including devDeps) needed for the build step.
# devDeps only live in this stage — they never reach the runner image.
RUN --mount=type=cache,id=${PNPM_CACHE_ID},target=/root/.local/share/pnpm/store \
    pnpm install \
      --frozen-lockfile \
    && rm -rf /root/.local/share/pnpm/store/v3/tmp

# Copy application source AFTER dependency install to maximise cache hits
COPY . .

# Generate Prisma client (required before next build for type resolution)
RUN pnpm db:generate

# Build Next.js with build-time placeholder env vars.
# output: "standalone" in next.config.ts gives us a self-contained server
# with zero full node_modules in the output directory.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    NEXTAUTH_SECRET="build-time-placeholder-secret-32chars!!" \
    NEXTAUTH_URL="http://localhost:3000" \
    pnpm build

# Strip dev-only source maps from the standalone output to further reduce size
RUN find .next/standalone -name "*.map" -delete 2>/dev/null || true

# -----------------------------------------------------------------------------
# Stage 4: runner — minimal production image (final artifact)
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner

# Install only what the runtime strictly requires
RUN apk add --no-cache libc6-compat openssl \
    && rm -rf /var/cache/apk/* /tmp/*

# Security: run as a non-root system user
# gid/uid 1001 is the conventional choice for nextjs containers
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ── Next.js standalone output ──────────────────────────────────────────────
# .next/standalone   → self-contained Node server (no node_modules needed)
# .next/static       → compiled client-side JS/CSS chunks
# public             → static assets served directly
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# ── Prisma runtime files (migration deploy + query engine) ────────────────
# Only the files needed at runtime; NO prisma dev CLI, NO migration source
COPY --from=builder --chown=nextjs:nodejs /app/prisma/schema.prisma          ./prisma/schema.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts              ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma      ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma           ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma          ./node_modules/@prisma

# ── Switch to non-root ─────────────────────────────────────────────────────
USER nextjs

EXPOSE 3000

# Health check — uses the built-in Node HTTP client, no extra tools needed
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=40s \
    --retries=3 \
    CMD node -e "\
      require('http').get('http://127.0.0.1:3000/api/health', (r) => \
        r.statusCode === 200 ? process.exit(0) : process.exit(1) \
      ).on('error', () => process.exit(1))"

# Run Prisma migrations then start the standalone server
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node server.js"]
