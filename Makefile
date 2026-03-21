# RAG Starter Kit - Docker Makefile
# All commands run inside Docker containers - no local dependencies needed

.PHONY: all dev prod down logs build clean-build prune install lint format check test \
        db-generate db-migrate db-migrate-prod db-studio db-seed backup

DC_DEV = docker compose -f docker-compose.dev.yml
DC_PROD = docker compose -f docker-compose.prod.yml
APP_DEV = $(DC_DEV) exec app

# =============================================================================
# Development
# =============================================================================

# Start development environment (attached)
dev:
	$(DC_DEV) up

# Start development environment (detached)
up:
	$(DC_DEV) up -d

# Stop all services
down:
	$(DC_DEV) down
	$(DC_PROD) down

# View logs
logs:
	$(DC_DEV) logs -f

# =============================================================================
# Build
# =============================================================================

# Build/rebuild development images
build:
	DOCKER_BUILDKIT=1 $(DC_DEV) build

# Clean build (no cache)
clean-build:
	DOCKER_BUILDKIT=1 $(DC_DEV) build --no-cache

# Prune Docker cache
prune:
	docker builder prune -f

# =============================================================================
# Production
# =============================================================================

# Start production environment
prod:
	$(DC_PROD) up -d

# Start production with backups
prod-with-backup:
	$(DC_PROD) --profile backup up -d

# =============================================================================
# Database
# =============================================================================

db-generate:
	$(APP_DEV) pnpm db:generate

db-migrate:
	$(APP_DEV) pnpm db:migrate

db-migrate-prod:
	$(DC_PROD) exec app pnpm db:migrate:prod

db-studio:
	$(APP_DEV) pnpm prisma studio --hostname 0.0.0.0

db-seed:
	$(APP_DEV) pnpm db:seed

# Create database backup
backup:
	mkdir -p backups
	$(DC_DEV) exec db pg_dump -U postgres ragdb | gzip > backups/backup-$$(date +%Y%m%d-%H%M%S).sql.gz

# =============================================================================
# Code Quality
# =============================================================================

install:
	$(APP_DEV) pnpm install

lint:
	$(APP_DEV) pnpm lint:fix

format:
	$(APP_DEV) pnpm format

check:
	$(APP_DEV) pnpm check:fix

# =============================================================================
# Testing
# =============================================================================

test:
	$(APP_DEV) pnpm test

test-run:
	$(APP_DEV) pnpm test:run

test-coverage:
	$(APP_DEV) pnpm test:coverage
