# Security Documentation

This document outlines the security measures implemented in the RAG Starter Kit.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Password Security](#password-security)
- [API Security](#api-security)
- [Data Protection](#data-protection)
- [CSRF Protection](#csrf-protection)
- [XSS Prevention](#xss-prevention)
- [Rate Limiting](#rate-limiting)
- [Account Lockout](#account-lockout)
- [Session Management](#session-management)
- [Security Headers](#security-headers)
- [Audit Logging](#audit-logging)
- [Vulnerability Reporting](#vulnerability-reporting)

## Overview

The RAG Starter Kit implements defense-in-depth security with multiple layers of protection.

## Authentication

### Methods Supported

- **Email/Password**: With bcrypt hashing (12 rounds)
- **OAuth 2.0**: GitHub, Google
- **SAML 2.0**: Enterprise SSO
- **API Keys**: For programmatic access with bcrypt hashing

### Password Policy

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Authorization

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Owner** | Full access to workspace |
| **Admin** | Manage members, settings, billing |
| **Member** | Create/read documents and chats |
| **Viewer** | Read-only access |

18 permissions across 4 roles.

## Data Protection

### Field-Level Encryption

Sensitive fields use AES-256-GCM encryption with envelope encryption pattern.

### Encryption at Rest

- PostgreSQL with TLS
- Cloudinary with server-side encryption
- Redis with TLS

## CSRF Protection

Uses HMAC-based double-submit cookie pattern:
- Tokens bound to user session
- HMAC-SHA256 for token generation
- Timing-safe comparison
- Automatic rotation on auth state change

## XSS Prevention

- DOMPurify for HTML sanitization
- Content Security Policy headers
- Input validation with Zod
- Output encoding

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 | 5 minutes |
| Register | 3 | 1 hour |
| Chat | 50 | 1 hour |
| API | 100 | 1 minute |

Uses sliding window algorithm with Redis.

## Account Lockout

- **Threshold**: 5 failed attempts
- **Lockout Duration**: 15 minutes (exponential backoff)
- **Max Duration**: 24 hours
- **Reset**: On successful login

## Session Management

```typescript
{
  strategy: 'jwt',
  maxAge: 7 * 24 * 60 * 60, // 7 days
  updateAge: 24 * 60 * 60,   // 24 hours
}
```

## Security Headers

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`
- `Content-Security-Policy`

## Audit Logging

20+ event types including:
- User authentication
- Permission changes
- API key operations
- Security events
- Data access

## ENCRYPTION_MASTER_KEY Rotation

`ENCRYPTION_MASTER_KEY` is used to encrypt sensitive values at rest (SAML private keys, webhook secrets, OAuth tokens stored in the database). It is required in production and validated at startup.

### Generating a key

```bash
openssl rand -base64 32
```

Store the output in the `ENCRYPTION_MASTER_KEY` environment variable (min 32 characters).

### Rotation procedure

Key rotation must re-encrypt all values encrypted with the old key before the old key is removed. The following procedure achieves zero-downtime rotation:

**Step 1 — Dual-key phase.** Add the new key as `ENCRYPTION_MASTER_KEY_NEW` while keeping `ENCRYPTION_MASTER_KEY` unchanged. Deploy.

**Step 2 — Re-encryption.** Run the migration script that reads each encrypted value with the old key and re-writes it with the new key:

```bash
# Dry-run first
pnpm tsx scripts/rotate-encryption-key.ts --dry-run

# Apply
pnpm tsx scripts/rotate-encryption-key.ts
```

> **Note:** This script does not exist yet — create it before your first production rotation. It must iterate over all tables that store encrypted columns (currently: `saml_providers.private_key`, `webhooks.secret`, `api_keys.key_hash`).

**Step 3 — Promote.** Set `ENCRYPTION_MASTER_KEY` to the new key value and remove `ENCRYPTION_MASTER_KEY_NEW`. Deploy.

**Step 4 — Verify.** Confirm all encrypted services (SAML SSO, webhooks, API key verification) work correctly before decommissioning the old key.

### What NOT to do

- **Never** delete `ENCRYPTION_MASTER_KEY` before re-encryption is complete — all encrypted values become permanently unreadable.
- **Never** commit the key to version control. Use a secrets manager (AWS Secrets Manager, Doppler, Vercel Environment Variables).
- **Never** reuse an old key after rotation.

### Emergency key loss

If the master key is lost there is no recovery path for encrypted values. Affected rows must be invalidated (API keys revoked, SAML configs deleted, webhooks disabled) and re-provisioned by users.

---

## Vulnerability Reporting

Report security vulnerabilities via [GitHub Security Advisories](https://github.com/rejisterjack/rag-starter-kit/security/advisories/new).

Do **not** open a public GitHub issue for security vulnerabilities. Security advisories allow coordinated disclosure and give maintainers time to patch before public disclosure.
