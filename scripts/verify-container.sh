#!/bin/bash
# Container Signature Verification Script
# Usage: ./scripts/verify-container.sh [IMAGE_URI]

set -e

IMAGE_URI="${1:-ghcr.io/${GITHUB_REPOSITORY:-$(git remote get-url origin 2>/dev/null | sed 's/.*:\/\///;s/.git$//' || echo 'user/repo')}:main}"

echo "🔐 Container Signature Verification"
echo "===================================="
echo ""
echo "Image: $IMAGE_URI"
echo ""

# Check if cosign is installed
if ! command -v cosign &> /dev/null; then
    echo "❌ Cosign not found. Installing..."
    
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case $ARCH in
        x86_64) ARCH="amd64" ;;
        arm64|aarch64) ARCH="arm64" ;;
    esac
    
    curl -L -o /tmp/cosign "https://github.com/sigstore/cosign/releases/latest/download/cosign-${OS}-${ARCH}"
    chmod +x /tmp/cosign
    sudo mv /tmp/cosign /usr/local/bin/cosign
    
    echo "✅ Cosign installed"
    echo ""
fi

echo "🔍 Verifying signature..."
if cosign verify \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    --certificate-identity-regexp "^https://github.com/.*/.github/workflows/.*$" \
    "$IMAGE_URI" 2>/dev/null; then
    echo ""
    echo "✅ Signature verified!"
else
    echo ""
    echo "❌ Verification failed!"
    exit 1
fi
