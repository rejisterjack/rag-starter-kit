.PHONY: all up down logs install dev build start lint format check test db-generate db-migrate db-studio db-seed inngest

DC = docker compose -f docker-compose.dev.yml
APP = $(DC) exec app

# Default target
all: dev

# Start the development environment (attached)
dev:
	$(DC) up

# Start the development environment (detached)
up:
	$(DC) up -d

# Stop the development environment
down:
	$(DC) down

# View logs
logs:
	$(DC) logs -f

# Rebuild the docker images
build:
	$(DC) build

# Install dependencies inside the running app container
install:
	$(APP) pnpm install

# Start the production server using the prod compose file
start:
	docker compose -f docker-compose.prod.yml up -d

# Run Biome linter and fix issues
lint:
	$(APP) pnpm lint:fix

# Format code with Biome
format:
	$(APP) pnpm format

# Run Biome checks and fix issues
check:
	$(APP) pnpm check:fix

# Run all tests
test:
	$(APP) pnpm test

# Generate Prisma client
db-generate:
	$(APP) pnpm db:generate

# Run Prisma database migrations
db-migrate:
	$(APP) pnpm db:migrate

# Open Prisma Studio
db-studio:
	$(APP) pnpm db:studio

# Seed the database
db-seed:
	$(APP) pnpm db:seed

# Restart or start the Inngest service
inngest:
	$(DC) up -d inngest
