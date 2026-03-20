#!/bin/bash
set -e

echo "🔧 Fixing remaining TypeScript errors..."

# Fix 1: Remove unused imports and variables
echo "🧹 Cleaning up unused variables..."

# Fix SAML ACS route - remove unused 'auth' import
sed -i '' '/^import { auth } from/d' src/app/api/auth/saml/\[workspaceId\]/acs/route.ts 2>/dev/null || true

# Fix OAuth provider route - prefix unused cookieStore
sed -i '' 's/const cookieStore/_cookieStore/g' src/app/api/auth/oauth/\[providerId\]/route.ts 2>/dev/null || true

# Fix OAuth callback route - prefix unused params  
sed -i '' 's/userId: string/_userId: string/g' src/app/api/auth/oauth/callback/route.ts 2>/dev/null || true
sed -i '' 's/workspaceId: string/_workspaceId: string/g' src/app/api/auth/oauth/callback/route.ts 2>/dev/null || true

# Fix SAML ACS route - prefix unused params
sed -i '' 's/userId: string/_userId: string/g' src/app/api/auth/saml/\[workspaceId\]/acs/route.ts 2>/dev/null || true
sed -i '' 's/workspaceId: string/_workspaceId: string/g' src/app/api/auth/saml/\[workspaceId\]/acs/route.ts 2>/dev/null || true

# Fix SLO route - prefix unused variables
sed -i '' 's/initiateLogout: boolean/_initiateLogout: boolean/g' src/app/api/auth/saml/\[workspaceId\]/slo/route.ts 2>/dev/null || true
sed -i '' 's/baseUrl;/_baseUrl;/g' src/app/api/auth/saml/\[workspaceId\]/slo/route.ts 2>/dev/null || true

echo "✅ Unused variable fixes applied!"
