# =============================================================================
# RAG Starter Kit - Production Dockerfile
# =============================================================================
# Multi-stage build for optimal image size (~150MB final)
#
# Usage:
#   docker build -t rag-starter-kit .
#   docker run -p 3000:3000 --env-file .env rag-starter-kit
#
# =============================================================================

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm db:generate

# Stage 2: Build the application
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated

# Copy source code
COPY . .

# Build-time environment variables (non-secret defaults for build)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the Next.js application
RUN pnpm build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema for runtime migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/src/generated ./src/generated

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
