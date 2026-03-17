#!/bin/bash
# =============================================================================
# Database Backup Script for RAG Starter Kit
# =============================================================================
# This script creates database backups with optional S3 upload
# Usage: ./scripts/backup.sh [options]
# Options:
#   --s3         Upload backup to S3 after creation
#   --retention  Number of days to keep local backups (default: 7)
#   --bucket     S3 bucket name (required if --s3 is used)
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
UPLOAD_S3=false
RETENTION_DAYS=7
S3_BUCKET=""
S3_PREFIX="backups"

# Backup configuration
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="rag_backup_${TIMESTAMP}.sql"

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║     Database Backup Script                                     ║"
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
            --s3)
                UPLOAD_S3=true
                shift
                ;;
            --bucket)
                S3_BUCKET="$2"
                shift 2
                ;;
            --retention)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --prefix)
                S3_PREFIX="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --s3              Upload backup to S3"
                echo "  --bucket NAME     S3 bucket name"
                echo "  --prefix PATH     S3 prefix/path (default: backups)"
                echo "  --retention DAYS  Local retention in days (default: 7)"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check for database URL
    if [ -z "$DATABASE_URL" ] && [ -z "$POSTGRES_URL_NON_POOLING" ]; then
        print_error "No database URL found"
        print_info "Please set DATABASE_URL or POSTGRES_URL_NON_POOLING environment variable"
        exit 1
    fi
    
    DB_URL="${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}"
    
    # Check for pg_dump
    if ! command -v pg_dump &> /dev/null; then
        print_error "pg_dump not found. Please install PostgreSQL client tools."
        print_info "  macOS: brew install libpq"
        print_info "  Ubuntu/Debian: apt-get install postgresql-client"
        exit 1
    fi
    
    print_success "Prerequisites met"
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        print_success "Created backup directory: $BACKUP_DIR"
    fi
}

# Create database backup
create_backup() {
    print_info "Creating database backup..."
    
    local backup_path="${BACKUP_DIR}/${FILENAME}"
    
    print_info "Dumping database to ${backup_path}..."
    
    if pg_dump \
        --verbose \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        "$DB_URL" > "$backup_path" 2>/dev/null; then
        print_success "Database dump completed"
    else
        print_error "Database dump failed"
        exit 1
    fi
    
    # Compress the backup
    print_info "Compressing backup..."
    if gzip -f "$backup_path"; then
        print_success "Backup compressed: ${backup_path}.gz"
        BACKUP_FILE="${backup_path}.gz"
    else
        print_warning "Compression failed, using uncompressed file"
        BACKUP_FILE="$backup_path"
    fi
    
    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_info "Backup size: $FILE_SIZE"
}

# Upload to S3
upload_to_s3() {
    if [ "$UPLOAD_S3" = false ]; then
        return 0
    fi
    
    print_info "Uploading to S3..."
    
    # Check for AWS CLI
    if ! command -v aws &> /dev/null; then
        print_warning "AWS CLI not found, skipping S3 upload"
        return 0
    fi
    
    # Check bucket name
    if [ -z "$S3_BUCKET" ]; then
        if [ -n "$BACKUP_BUCKET" ]; then
            S3_BUCKET="$BACKUP_BUCKET"
        else
            print_error "S3 bucket not specified. Use --bucket or set BACKUP_BUCKET env var"
            return 1
        fi
    fi
    
    # Upload with timestamp prefix
    S3_KEY="${S3_PREFIX}/${FILENAME}.gz"
    
    if aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/${S3_KEY}"; then
        print_success "Backup uploaded to s3://${S3_BUCKET}/${S3_KEY}"
        
        # Create latest symlink
        aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "s3://${S3_BUCKET}/${S3_PREFIX}/latest.sql.gz" || true
    else
        print_error "S3 upload failed"
        return 1
    fi
}

# Clean up old backups
cleanup_old_backups() {
    print_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    local deleted_count=0
    
    # Find and delete old backups
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            rm -f "$file"
            print_info "Deleted: $(basename "$file")"
            ((deleted_count++)) || true
        fi
    done < <(find "$BACKUP_DIR" -name "rag_backup_*.sql*" -mtime +$RETENTION_DAYS 2>/dev/null)
    
    if [ $deleted_count -gt 0 ]; then
        print_success "Cleaned up $deleted_count old backup(s)"
    else
        print_info "No old backups to clean up"
    fi
}

# Verify backup integrity
verify_backup() {
    print_info "Verifying backup integrity..."
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file not found"
        return 1
    fi
    
    # Check if file is valid gzip
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        if gzip -t "$BACKUP_FILE" 2>/dev/null; then
            print_success "Backup file is valid"
        else
            print_error "Backup file is corrupted"
            return 1
        fi
    fi
}

# Send notification (placeholder for integration)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Example: Send to Slack
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${message}\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null || true
    fi
    
    # Example: Send to Discord
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"${message}\"}" \
            "$DISCORD_WEBHOOK_URL" > /dev/null || true
    fi
}

# Main function
main() {
    print_header
    parse_args "$@"
    
    check_prerequisites
    create_backup_dir
    create_backup
    verify_backup
    upload_to_s3
    cleanup_old_backups
    
    echo ""
    print_success "Backup completed successfully!"
    print_info "Backup location: $BACKUP_FILE"
    
    if [ "$UPLOAD_S3" = true ]; then
        print_info "S3 location: s3://${S3_BUCKET}/${S3_KEY}"
    fi
    
    # Send success notification
    send_notification "success" "✅ Database backup completed: ${FILENAME}.gz (${FILE_SIZE})"
}

# Handle errors
trap 'print_error "Backup failed!"; send_notification "error" "❌ Database backup failed"' ERR

# Run main function
main "$@"
