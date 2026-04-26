# RAG Starter Kit - Docker Makefile
# Single docker-compose.yml — no local dependencies required

.PHONY: help up up-d up-analytics up-backup up-full down down-v \
        logs logs-app build build-no-cache prune \
        db-shell db-migrate db-studio db-seed db-backup \
        shell cmd lint lint-fix format type-check \
        test test-run test-coverage status clean

DC      = docker compose
APP     = $(DC) exec app

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# Help
# =============================================================================

help: ## Show this help message
	@echo ""
	@echo "  RAG Starter Kit — Docker Commands"
	@echo "  =================================="
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# =============================================================================
# Stack Lifecycle
# =============================================================================

up: ## Start core services (attached)
	DOCKER_BUILDKIT=1 $(DC) up

up-d: ## Start core services (detached)
	DOCKER_BUILDKIT=1 $(DC) up -d

up-analytics: ## Start core services + Plausible analytics
	DOCKER_BUILDKIT=1 $(DC) --profile analytics up -d

up-backup: ## Start core services + scheduled DB backup
	DOCKER_BUILDKIT=1 $(DC) --profile backup up -d

up-full: ## Start everything (analytics + backup)
	DOCKER_BUILDKIT=1 $(DC) --profile analytics --profile backup up -d

down: ## Stop all running services
	$(DC) down

down-v: ## Stop and remove all volumes ⚠️  destroys data
	$(DC) down -v
	$(DC) --profile analytics --profile backup down -v

logs: ## Tail logs from all running services
	$(DC) logs -f

logs-app: ## Tail app logs only
	$(DC) logs -f app

# =============================================================================
# Build & Maintenance
# =============================================================================

build: ## Build / rebuild images (uses BuildKit cache)
	DOCKER_BUILDKIT=1 $(DC) build

build-no-cache: ## Full clean rebuild (no cache)
	DOCKER_BUILDKIT=1 $(DC) build --no-cache

prune: ## Prune Docker build cache and dangling images
	docker builder prune -f
	docker image prune -f

# =============================================================================
# Database
# =============================================================================

db-shell: ## Open an interactive PostgreSQL shell
	$(DC) exec db psql -U postgres -d ragdb

db-migrate: ## Run Prisma migrations (development)
	$(APP) pnpm db:migrate

db-migrate-prod: ## Run Prisma migrations (production / deploy)
	$(APP) pnpm db:migrate:prod

db-studio: ## Launch Prisma Studio  →  http://localhost:5555
	$(APP) pnpm prisma studio --hostname 0.0.0.0 --port 5555 --browser none

db-seed: ## Seed the database with sample data
	$(APP) pnpm db:seed

db-backup: ## Create a one-off gzipped PostgreSQL backup
	@mkdir -p backups
	$(DC) exec db pg_dump -U postgres ragdb | gzip > backups/backup-$$(date +%Y%m%d-%H%M%S).sql.gz
	@echo "✅  Backup saved to backups/"

# =============================================================================
# Application Shell
# =============================================================================

shell: ## Open an interactive shell inside the app container
	$(APP) sh

cmd: ## Run any command inside the app container  (usage: make cmd CMD="pnpm lint")
	$(APP) $(CMD)

# =============================================================================
# Code Quality
# =============================================================================

lint: ## Run Biome linter
	$(APP) pnpm lint

lint-fix: ## Run Biome linter with auto-fix
	$(APP) pnpm lint:fix

format: ## Format source code
	$(APP) pnpm format

type-check: ## TypeScript type-check (no emit)
	$(APP) pnpm type-check

# =============================================================================
# Testing
# =============================================================================

test: ## Run Vitest in watch mode
	$(APP) pnpm test

test-run: ## Run Vitest once
	$(APP) pnpm test:run

test-coverage: ## Run Vitest with coverage report
	$(APP) pnpm test:coverage

# =============================================================================
# Utilities
# =============================================================================

status: ## Show running container status
	$(DC) ps

clean: down-v prune ## Full cleanup — stop containers, remove volumes, prune cache
