# RAG Starter Kit - Docker Makefile
# Complete Docker-based development - no local dependencies required

.PHONY: help dev prod down logs build clean prune test db-migrate db-studio backup

DC_DEV = docker compose -f docker-compose.dev.yml
DC_PROD = docker compose -f docker-compose.prod.yml
APP_DEV = $(DC_DEV) exec -it app

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# Help
# =============================================================================

help: ## Show this help message
	@echo "RAG Starter Kit - Docker Commands"
	@echo "=================================="
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# =============================================================================
# Development
# =============================================================================

dev: ## Start development environment (attached)
	$(DC_DEV) up

dev-d: ## Start development environment (detached)
	$(DC_DEV) up -d

prod: ## Start production environment
	$(DC_PROD) up -d

prod-backup: ## Start production with automated backups
	$(DC_PROD) --profile backup up -d

down: ## Stop all environments
	$(DC_DEV) down
	$(DC_PROD) down

down-v: ## Stop and remove all volumes (⚠️ destroys data)
	$(DC_DEV) down -v
	$(DC_PROD) down -v

logs: ## View logs from all services
	$(DC_DEV) logs -f

logs-app: ## View app logs only
	$(DC_DEV) logs -f app

# =============================================================================
# Build & Maintenance
# =============================================================================

build: ## Build/rebuild development images
	DOCKER_BUILDKIT=1 $(DC_DEV) build

build-no-cache: ## Clean build (no cache)
	DOCKER_BUILDKIT=1 $(DC_DEV) build --no-cache

prune: ## Prune Docker build cache and unused images
	docker builder prune -f
	docker image prune -f

# =============================================================================
# Database
# =============================================================================

db-shell: ## Open PostgreSQL shell
	$(DC_DEV) exec db psql -U postgres -d ragdb

db-migrate: ## Run database migrations
	$(APP_DEV) pnpm db:migrate

db-migrate-prod: ## Run production migrations
	$(DC_PROD) exec app pnpm db:migrate:prod

db-studio: ## Open Prisma Studio (http://localhost:5555)
	$(APP_DEV) pnpm prisma studio --hostname 0.0.0.0

db-seed: ## Seed database with sample data
	$(APP_DEV) pnpm db:seed

db-backup: ## Create database backup
	@mkdir -p backups
	$(DC_DEV) exec db pg_dump -U postgres ragdb | gzip > backups/backup-$$(date +%Y%m%d-%H%M%S).sql.gz
	@echo "✅ Backup created in backups/"

# =============================================================================
# Application Shell & Commands
# =============================================================================

shell: ## Open shell in app container
	$(APP_DEV) sh

cmd: ## Run custom command in app container (usage: make cmd CMD="pnpm lint")
	$(APP_DEV) $(CMD)

# =============================================================================
# Code Quality
# =============================================================================

lint: ## Run linter
	$(APP_DEV) pnpm lint

lint-fix: ## Run linter with auto-fix
	$(APP_DEV) pnpm lint:fix

format: ## Format code
	$(APP_DEV) pnpm format

type-check: ## Run TypeScript type checking
	$(APP_DEV) pnpm type-check

# =============================================================================
# Testing
# =============================================================================

test: ## Run tests in watch mode
	$(APP_DEV) pnpm test

test-run: ## Run tests once
	$(APP_DEV) pnpm test:run

test-coverage: ## Run tests with coverage
	$(APP_DEV) pnpm test:coverage

# =============================================================================
# Utilities
# =============================================================================

status: ## Check container status
	$(DC_DEV) ps

clean: down-v prune ## Complete cleanup (stop, remove volumes, prune)
