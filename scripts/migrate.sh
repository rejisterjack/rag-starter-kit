#!/bin/bash
# =============================================================================
# Production-Safe Database Migration Script
# =============================================================================
# This script performs safe database migrations with pre and post checks
# Usage: ./scripts/migrate.sh [options]
# Options:
#   --dry-run    Preview migrations without applying
#   --force      Skip confirmation prompts
#   --backup     Create backup before migration
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default options
DRY_RUN=false
FORCE=false
BACKUP=false

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║     Database Migration Script                                  ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --backup)
                BACKUP=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --dry-run    Preview migrations without applying"
                echo "  --force      Skip confirmation prompts"
                echo "  --backup     Create backup before migration"
                echo "  --help       Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Check database connection
check_database_connection() {
    print_info "Checking database connection..."
    
    if ! command -v npx &> /dev/null; then
        print_error "npx not found. Please install Node.js and npm."
        exit 1
    fi
    
    # Try to run prisma db ping
    if npx prisma db execute --stdin <<<'SELECT 1' &>/dev/null; then
        print_success "Database connection successful"
    else
        print_error "Could not connect to database"
        print_info "Please check your DATABASE_URL environment variable"
        exit 1
    fi
}

# Check for pending migrations
check_pending_migrations() {
    print_info "Checking for pending migrations..."
    
    PENDING=$(npx prisma migrate status --preview-feature 2>/dev/null | grep -c "Pending" || echo "0")
    
    if [ "$PENDING" -eq "0" ]; then
        print_success "No pending migrations found"
        return 1
    else
        print_warning "Found $PENDING pending migration(s)"
        return 0
    fi
}

# Create database backup
create_backup() {
    if [ "$BACKUP" = false ]; then
        return 0
    fi
    
    print_info "Creating database backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backup_${TIMESTAMP}.sql"
    BACKUP_DIR="${PROJECT_ROOT}/backups"
    
    mkdir -p "$BACKUP_DIR"
    
    # Extract database URL from environment
    if [ -z "$POSTGRES_URL_NON_POOLING" ] && [ -z "$DATABASE_URL" ]; then
        print_warning "No database URL found, skipping backup"
        return 0
    fi
    
    DB_URL="${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}"
    
    if pg_dump "$DB_URL" > "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null; then
        gzip "${BACKUP_DIR}/${BACKUP_FILE}"
        print_success "Backup created: ${BACKUP_DIR}/${BACKUP_FILE}.gz"
    else
        print_warning "Failed to create backup (pg_dump not available or connection failed)"
    fi
}

# Check for vector extension
check_vector_extension() {
    print_info "Checking pgvector extension..."
    
    VECTOR_EXISTS=$(npx prisma db execute --stdin <<<"SELECT 1 FROM pg_extension WHERE extname = 'vector'" 2>/dev/null | grep -c "1" || echo "0")
    
    if [ "$VECTOR_EXISTS" -gt "0" ]; then
        print_success "pgvector extension is installed"
    else
        print_warning "pgvector extension not found, attempting to create..."
        npx prisma db execute --stdin <<<"CREATE EXTENSION IF NOT EXISTS vector;" || {
            print_error "Failed to create pgvector extension"
            print_info "Please ensure pgvector is installed on your PostgreSQL server"
            exit 1
        }
        print_success "pgvector extension created"
    fi
}

# Preview migrations (dry run)
preview_migrations() {
    print_info "Previewing pending migrations..."
    npx prisma migrate status
}

# Apply migrations
apply_migrations() {
    print_info "Applying database migrations..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "Dry run mode - migrations will not be applied"
        npx prisma migrate diff --from-url "$POSTGRES_URL_NON_POOLING" --to-schema-datamodel "$PROJECT_ROOT/prisma/schema.prisma"
        return 0
    fi
    
    # Deploy migrations (production-safe, non-destructive)
    if npx prisma migrate deploy; then
        print_success "Migrations applied successfully"
    else
        print_error "Migration failed"
        exit 1
    fi
}

# Generate Prisma client
generate_client() {
    print_info "Generating Prisma client..."
    
    if npx prisma generate; then
        print_success "Prisma client generated"
    else
        print_error "Failed to generate Prisma client"
        exit 1
    fi
}

# Run post-migration verification
verify_migration() {
    print_info "Running post-migration verification..."
    
    # Check if we can query the database
    if npx prisma db execute --stdin <<<"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" &>/dev/null; then
        print_success "Database is accessible"
    else
        print_error "Database verification failed"
        exit 1
    fi
    
    # Verify critical tables exist
    REQUIRED_TABLES=("User" "Document" "DocumentChunk" "Chat" "Message")
    for table in "${REQUIRED_TABLES[@]}"; do
        TABLE_EXISTS=$(npx prisma db execute --stdin <<<"SELECT 1 FROM information_schema.tables WHERE table_name = '$table'" 2>/dev/null | grep -c "1" || echo "0")
        if [ "$TABLE_EXISTS" -gt "0" ]; then
            print_success "Table '$table' exists"
        else
            print_warning "Table '$table' not found"
        fi
    done
}

# Confirm before production migration
confirm_production() {
    if [ "$FORCE" = true ]; then
        return 0
    fi
    
    echo ""
    print_warning "You are about to run migrations on the production database!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [[ $confirm != "yes" ]]; then
        print_info "Migration cancelled"
        exit 0
    fi
}

# Main function
main() {
    print_header
    parse_args "$@"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Check if we're in production
    if [ "$NODE_ENV" = "production" ]; then
        confirm_production
    fi
    
    # Pre-migration checks
    check_database_connection
    
    if ! check_pending_migrations; then
        print_success "Database is up to date"
        generate_client
        exit 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        preview_migrations
        exit 0
    fi
    
    # Create backup if requested
    create_backup
    
    # Check vector extension
    check_vector_extension
    
    # Apply migrations
    apply_migrations
    
    # Generate client
    generate_client
    
    # Post-migration verification
    verify_migration
    
    echo ""
    print_success "Migration completed successfully!"
    print_info "Next steps:"
    echo "  - Verify application functionality"
    echo "  - Check logs for any errors"
    echo "  - Run smoke tests if available"
}

# Handle errors
trap 'print_error "An error occurred during migration. Check the logs above."' ERR

# Run main function
main "$@"
