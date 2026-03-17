#!/bin/bash
# =============================================================================
# Environment Setup Script for RAG Starter Kit
# =============================================================================
# This script helps set up environment variables for different environments
# Usage: ./scripts/setup-env.sh [environment]
# Environments: development, production
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

# Environment (default: development)
ENVIRONMENT="${1:-development}"

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║     RAG Starter Kit - Environment Setup                        ║"
    echo "║     Environment: $ENVIRONMENT                                   ║"
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

# Check if required commands exist
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v openssl &> /dev/null; then
        print_error "openssl is required but not installed"
        exit 1
    fi
    
    print_success "Prerequisites met"
}

# Generate a secure random secret
generate_secret() {
    openssl rand -base64 32
}

# Setup development environment
setup_development() {
    print_info "Setting up development environment..."
    
    ENV_FILE="$PROJECT_ROOT/.env.local"
    EXAMPLE_FILE="$PROJECT_ROOT/.env.local.example"
    
    if [ -f "$ENV_FILE" ]; then
        print_warning ".env.local already exists"
        read -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_info "Skipping .env.local creation"
            return
        fi
    fi
    
    if [ -f "$EXAMPLE_FILE" ]; then
        cp "$EXAMPLE_FILE" "$ENV_FILE"
        print_success "Created .env.local from example"
    else
        print_warning ".env.local.example not found, creating minimal config"
        cat > "$ENV_FILE" << 'EOF'
# Development environment variables
POSTGRES_PRISMA_URL="postgres://user:password@localhost:5432/ragdb?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgres://user:password@localhost:5432/ragdb"
NEXTAUTH_SECRET="dev-secret-do-not-use-in-production"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY=""
EOF
    fi
    
    # Generate secrets
    NEXTAUTH_SECRET=$(generate_secret)
    
    # Update the file with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"/" "$ENV_FILE"
    else
        # Linux
        sed -i "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"/" "$ENV_FILE"
    fi
    
    print_success "Development environment configured"
    print_info "Please update the following in .env.local:"
    print_info "  - Database connection strings"
    print_info "  - OpenAI API key"
    print_info "  - OAuth credentials (optional)"
}

# Setup production environment
setup_production() {
    print_info "Setting up production environment..."
    
    ENV_FILE="$PROJECT_ROOT/.env.production"
    EXAMPLE_FILE="$PROJECT_ROOT/.env.production.example"
    
    if [ -f "$ENV_FILE" ]; then
        print_warning ".env.production already exists"
        read -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_info "Skipping .env.production creation"
            return
        fi
    fi
    
    if [ -f "$EXAMPLE_FILE" ]; then
        cp "$EXAMPLE_FILE" "$ENV_FILE"
        print_success "Created .env.production from example"
    else
        print_error ".env.production.example not found"
        exit 1
    fi
    
    # Generate secrets
    NEXTAUTH_SECRET=$(generate_secret)
    
    # Update the file with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"/" "$ENV_FILE"
    else
        # Linux
        sed -i "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"/" "$ENV_FILE"
    fi
    
    print_success "Production environment template created"
    print_warning "IMPORTANT: Update all values in .env.production before deploying!"
}

# Validate environment variables
validate_env() {
    print_info "Validating environment variables..."
    
    local env_file="$1"
    local required_vars=(
        "POSTGRES_PRISMA_URL"
        "POSTGRES_URL_NON_POOLING"
        "NEXTAUTH_SECRET"
        "NEXTAUTH_URL"
        "OPENAI_API_KEY"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file" 2>/dev/null || \
           grep "^${var}=" "$env_file" | grep -q '=""\|= ""$'; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        print_success "All required variables are set"
        return 0
    else
        print_warning "Missing or empty required variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        return 1
    fi
}

# Interactive configuration
interactive_config() {
    print_info "Starting interactive configuration..."
    
    ENV_FILE="$PROJECT_ROOT/.env.local"
    
    echo ""
    read -p "Enter your OpenAI API key: " openai_key
    echo ""
    read -p "Enter your database URL (default: localhost): " db_url
    db_url=${db_url:-localhost}
    echo ""
    read -p "Enter database user (default: postgres): " db_user
    db_user=${db_user:-postgres}
    echo ""
    read -sp "Enter database password (default: postgres): " db_pass
    echo ""
    db_pass=${db_pass:-postgres}
    
    # Update values
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=\"$openai_key\"|" "$ENV_FILE"
        sed -i '' "s|POSTGRES_PRISMA_URL=.*|POSTGRES_PRISMA_URL=\"postgres://$db_user:$db_pass@$db_url:5432/ragdb?pgbouncer=true&connect_timeout=15\"|" "$ENV_FILE"
        sed -i '' "s|POSTGRES_URL_NON_POOLING=.*|POSTGRES_URL_NON_POOLING=\"postgres://$db_user:$db_pass@$db_url:5432/ragdb\"|" "$ENV_FILE"
    else
        sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=\"$openai_key\"|" "$ENV_FILE"
        sed -i "s|POSTGRES_PRISMA_URL=.*|POSTGRES_PRISMA_URL=\"postgres://$db_user:$db_pass@$db_url:5432/ragdb?pgbouncer=true&connect_timeout=15\"|" "$ENV_FILE"
        sed -i "s|POSTGRES_URL_NON_POOLING=.*|POSTGRES_URL_NON_POOLING=\"postgres://$db_user:$db_pass@$db_url:5432/ragdb\"|" "$ENV_FILE"
    fi
    
    print_success "Configuration updated"
}

# Main function
main() {
    print_header
    check_prerequisites
    
    case "$ENVIRONMENT" in
        development|dev)
            setup_development
            validate_env "$PROJECT_ROOT/.env.local" || true
            
            read -p "Would you like to run interactive configuration? (y/N): " run_interactive
            if [[ $run_interactive =~ ^[Yy]$ ]]; then
                interactive_config
            fi
            ;;
        production|prod)
            setup_production
            validate_env "$PROJECT_ROOT/.env.production" || true
            print_warning "Remember to set environment variables in your hosting platform (Vercel, etc.)"
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            echo "Usage: $0 [development|production]"
            exit 1
            ;;
    esac
    
    echo ""
    print_success "Setup complete!"
    print_info "Next steps:"
    
    if [ "$ENVIRONMENT" = "development" ] || [ "$ENVIRONMENT" = "dev" ]; then
        echo "  1. Review and update .env.local"
        echo "  2. Run 'pnpm db:migrate' to set up the database"
        echo "  3. Run 'pnpm dev' to start the development server"
    else
        echo "  1. Review and update .env.production"
        echo "  2. Set environment variables in Vercel dashboard"
        echo "  3. Deploy with 'vercel --prod'"
    fi
}

# Run main function
main "$@"
