# Security Documentation

This document provides a comprehensive overview of the security architecture, controls, and procedures implemented in the RAG Starter Kit. It is intended for security teams, compliance auditors, and engineering teams evaluating the platform for enterprise deployment.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Session Management](#session-management)
- [Authorization](#authorization)
- [Data Encryption](#data-encryption)
- [Rate Limiting](#rate-limiting)
- [CSRF Protection](#csrf-protection)
- [Content Security Policy](#content-security-policy)
- [Audit Logging](#audit-logging)
- [Account Security](#account-security)
- [API Security](#api-security)
- [Input Validation](#input-validation)
- [Infrastructure Security](#infrastructure-security)
- [Encryption Key Rotation](#encryption-key-rotation)
- [Vulnerability Reporting](#vulnerability-reporting)

---

## Overview

The RAG Starter Kit implements defense-in-depth security with multiple independent layers of protection. Every layer is designed so that the failure of a single control does not result in a security breach. Security controls are enforced at the middleware level, within individual route handlers, and at the data layer.

Key principles:
- **Zero trust**: Every request is authenticated and authorized, regardless of origin.
- **Defense in depth**: Multiple overlapping controls protect each asset.
- **Least privilege**: Users and services receive only the minimum permissions required.
- **Auditability**: All security-relevant events are logged with tamper-evident hash chains.
- **Secure by default**: Production deployments require encryption keys; development-only fallbacks are explicitly marked.

---

## Authentication

### Framework

The platform uses **NextAuth.js v5** (Auth.js) as its authentication framework, configured with the JWT session strategy.

### Supported Methods

| Method | Use Case | Implementation |
|--------|----------|----------------|
| **Email/Password** | Standard user login | Credentials provider with bcrypt (12 rounds) |
| **OAuth 2.0** | Social login | GitHub and Google providers |
| **SAML 2.0 SSO** | Enterprise single sign-on | SAML provider with encrypted private keys |
| **API Keys** | Programmatic access | Bearer token or `X-API-Key` header |

### Password Policy

Passwords are validated using Zod schemas at registration and during password changes. The policy enforces:

- Minimum 12 characters, maximum 128 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- At least one special character from the set `!@#$%^&*()_+-=[]{}|;':",.<>/?`
- Email addresses are normalized to lowercase and capped at 254 characters

Passwords are hashed with bcrypt using 12 salt rounds before storage.

### Authentication Flow

1. User submits credentials via the login form or OAuth redirect.
2. The proxy (`src/proxy.ts`) intercepts the request and validates the JWT token.
3. If no valid session exists, unauthenticated users are redirected to `/login` for page routes or receive a `401 Unauthorized` JSON response for API routes.
4. Admin routes additionally check for the `ADMIN` role before allowing access.

---

## Session Management

### JWT Configuration

Sessions use the JWT strategy with the following parameters:

```typescript
{
  strategy: 'jwt',
  maxAge: 7 * 24 * 60 * 60, // 7 days
  updateAge: 24 * 60 * 60,  // 24 hours
}
```

### Session Fingerprinting

To mitigate session token theft, each session is bound to a client fingerprint derived from:

- **User-Agent**: Browser family and OS (version numbers stripped to prevent false positives on browser updates).
- **Accept-Language**: Primary language preference.

IP addresses are intentionally excluded from the fingerprint because mobile, VPN, and corporate proxy users frequently change IPs, which would cause false session invalidations.

The fingerprint is stored in the JWT and verified on every authenticated API request in middleware. A mismatch returns `401` with the code `SESSION_FINGERPRINT_MISMATCH`.

Implementation: `src/lib/security/session-fingerprint.ts`

### Session Revocation

JWT sessions can be revoked before their natural expiration using a Redis-backed revocation store:

- Individual sessions are revoked by JTI (JWT ID).
- All sessions for a user can be revoked simultaneously (e.g., on password change or security event).
- Revocation entries are stored with a TTL matching the token's remaining life (maximum 7 days).

Implementation: `src/lib/security/session-store.ts`

### Device Identification

The middleware propagates user context to downstream handlers via request headers:

- `x-request-id`: UUID for request tracing
- `x-nonce`: Per-request CSP nonce
- `x-user-id`: Authenticated user ID
- `x-user-role`: User role (e.g., `ADMIN`, `USER`)
- `x-workspace-id`: Active workspace context

---

## Authorization

### Role-Based Access Control (RBAC)

The platform implements a hierarchical role system with four roles and 18 granular permissions:

| Role | Description | Permission Count |
|------|-------------|-----------------|
| **Owner** | Full workspace control including billing and deletion | 17 |
| **Admin** | Manage members, settings, documents, chats, and API keys (no billing, no workspace deletion) | 15 |
| **Member** | Create and read documents, share documents, create and delete chats | 6 |
| **Viewer** | Read-only access to documents and chats | 2 |

### Permission Model

The 18 permissions are organized by resource:

**Documents:**
- `read:documents` -- View documents
- `write:documents` -- Upload and edit documents
- `delete:documents` -- Remove documents
- `share:documents` -- Share documents with others

**Chats:**
- `read:chats` -- View chat conversations
- `write:chats` -- Send messages
- `delete:chats` -- Delete conversations

**Workspace:**
- `manage:workspace` -- Modify workspace settings
- `manage:members` -- Invite, remove, and change member roles
- `manage:settings` -- Update workspace configuration
- `manage:billing` -- Manage billing and subscriptions

**API:**
- `manage:api_keys` -- Create, update, and revoke API keys
- `read:api_usage` -- View API usage statistics

**Administration:**
- `view:audit_logs` -- Access audit trail
- `delete:workspace` -- Delete the entire workspace

**Webhooks:**
- `read:webhooks` -- View webhook configurations
- `manage:webhooks` -- Create, update, and delete webhooks

### Permission Enforcement

Permissions are checked via cached lookups. When a role change occurs, the permission cache is invalidated. Denied permission checks are logged as audit events with severity `WARNING`.

Implementation: `src/lib/workspace/permissions.ts`

---

## Data Encryption

### Field-Level Encryption

Sensitive data fields are encrypted at rest using **AES-256-GCM** authenticated encryption.

**Algorithm parameters:**
- Algorithm: AES-256-GCM
- IV length: 16 bytes (randomly generated per encryption operation)
- Auth tag length: 16 bytes
- Salt length: 32 bytes
- Key derivation: scrypt (N=16384, r=8, p=1)

**Key management approaches:**

| Provider | Configuration | Use Case |
|----------|--------------|----------|
| **Local** | `ENCRYPTION_MASTER_KEY` env var | Development and single-instance deployments |
| **AWS KMS** | `KMS_PROVIDER=aws`, `AWS_KMS_KEY_ID` | Production with AWS infrastructure |
| **Azure Key Vault** | `KMS_PROVIDER=azure`, `AZURE_KEY_VAULT_URL` | Production with Azure infrastructure |
| **GCP KMS** | `KMS_PROVIDER=gcp`, `GCP_KMS_KEY_NAME` | Production with GCP infrastructure |

### Envelope Encryption (Production)

For production deployments, the platform uses envelope encryption:

1. A unique data encryption key (DEK) is generated per encryption operation using the KMS provider.
2. The plaintext is encrypted with the DEK using AES-256-GCM.
3. The DEK is encrypted (wrapped) by the KMS and stored alongside the ciphertext.
4. The plaintext DEK is zeroed from memory immediately after use.

Encrypted fields are stored as JSON with the structure:
```json
{
  "ciphertext": "<base64>",
  "iv": "<base64>",
  "authTag": "<base64>",
  "version": 2,
  "encryptedDataKey": "<base64>",
  "kmsProvider": "aws"
}
```

### Prisma Middleware Integration

Field encryption can be applied transparently via Prisma middleware, automatically encrypting fields on write and decrypting on read. This ensures sensitive data is never stored in plaintext regardless of application code paths.

### TLS in Transit

All data in transit is encrypted using TLS 1.2 or higher:
- PostgreSQL connections use TLS
- Redis connections use TLS
- All HTTP traffic is served over HTTPS
- HSTS is enforced in production with `max-age=31536000; includeSubDomains; preload`

Implementation: `src/lib/security/encryption.ts`, `src/lib/security/field-encryption.ts`

---

## Rate Limiting

### Architecture

Rate limiting uses the **Upstash Redis sliding window** algorithm in production, with an in-memory fallback for development.

### Endpoint Limits

| Endpoint Category | Limit | Window | Key |
|-------------------|-------|--------|-----|
| Chat | 50 requests | 1 hour | User ID |
| Chat Streaming | 50 requests | 1 hour | User ID |
| Document Ingestion | 10 requests | 1 hour | User ID |
| URL Ingestion | 20 requests | 1 hour | User ID |
| OCR | 30 requests | 1 hour | User ID |
| General API | 100 requests | 1 minute | User ID or IP |
| API Key | 1000 requests | 1 minute | API Key ID |
| Login | 5 requests | 5 minutes | User ID or IP |
| Registration | 3 requests | 1 hour | IP |
| Password Reset | 3 requests | 1 hour | IP |
| Workspace | 50 requests | 1 minute | User ID |
| Documents | 30 requests | 1 minute | User ID |
| Admin | 100 requests | 1 minute | User ID |
| Voice | 30 requests | 1 hour | User ID |
| Agent | 50 requests | 1 hour | User ID |
| Export | 10 requests | 1 hour | User ID |
| Search | 100 requests | 1 minute | User ID |
| Feedback | 30 requests | 1 minute | User ID |
| Sharing | 20 requests | 1 minute | User ID |
| Demo (public) | 20 requests | 15 minutes | IP |

### IP-Based Rate Limiting (Unauthenticated Requests)

Unauthenticated API requests are subject to stricter IP-based rate limiting with:

- **Base limit**: 30 requests per minute per IP
- **Progressive penalties**: Violations increase the penalty multiplier (up to 8x stricter)
- **CAPTCHA challenges**: Triggered after 3 violations within 5 minutes
- **IP blocking**: Automatic 15-minute block after 5 violations
- **IP reputation tracking**: 0-100 score tracked in Redis with 24-hour expiry

### Rate Limit Headers

Successful responses include rate limit information:
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 2026-05-06T12:00:00.000Z
```

When rate limited, responses include `Retry-After` with the seconds until reset.

Implementation: `src/lib/security/rate-limiter.ts`, `src/lib/security/ip-rate-limiter.ts`, `src/lib/security/ip-rate-limiter-edge.ts`

---

## CSRF Protection

The platform implements CSRF protection using the **HMAC-based double-submit cookie pattern**.

### How It Works

1. **Token generation**: A random 16-byte nonce is generated. An HMAC-SHA256 signature is computed over `version:sessionId:nonce` using the server-side CSRF secret.
2. **Token delivery**: The token (`version:nonce:hmac`) is delivered to the client via a meta tag. The nonce is stored in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie.
3. **Token validation**: On state-changing requests (POST, PUT, DELETE, PATCH), the middleware reads the token from the `x-csrf-token` header and the nonce from the cookie, then verifies the HMAC using timing-safe comparison.

### Protected Routes

CSRF tokens are required for all state-changing requests to:

- `/api/admin`
- `/api/export`
- `/api/invite`
- `/api/chat`
- `/api/ingest`
- `/api/documents`
- `/api/workspaces`
- `/api/api-keys`
- `/api/webhooks`
- `/api/billing`
- `/api/voice`

### Exemptions

- Authenticated users with valid session cookies are protected by `SameSite=Strict`, so CSRF token enforcement is applied primarily for unauthenticated requests and defense in depth.
- API key authentication bypasses CSRF checks (keys are sent in headers, not cookies).
- Safe HTTP methods (GET, HEAD, OPTIONS) are never CSRF-checked.

### Cookie Properties

```
csrf_token=<nonce>; HttpOnly; SameSite=Strict; Path=/; Secure; Max-Age=86400
```

Implementation: `src/lib/security/csrf.tsx`, `src/proxy.ts`

---

## Content Security Policy

CSP headers are generated per-request with unique nonces to prevent inline script injection.

### Nonce Generation

Each request generates a cryptographically random 16-byte nonce in middleware. This nonce is:
- Passed to server components via the `x-nonce` request header.
- Included in the `Content-Security-Policy` header.
- Available in development via the `X-Nonce` response header for debugging.

### Policy Directives

Production CSP:
```
default-src 'self';
script-src 'self' 'nonce-<nonce>';
style-src 'self' 'nonce-<nonce>' https://cdn.jsdelivr.net;
img-src 'self' blob: data: https://res.cloudinary.com https://*.githubusercontent.com https://*.googleusercontent.com;
font-src 'self' https://cdn.jsdelivr.net;
connect-src 'self' https://api.openai.com https://openrouter.ai https://*.openrouter.ai https://generativelanguage.googleapis.com https://*.googleapis.com https://*.upstash.io https://vitals.vercel-insights.com https://*.vercel-scripts.com https://va.vercel-scripts.com https://*.plausible.io https://*.inngest.com https://api.github.com wss://*.vercel.app wss://*.inngest.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
report-uri /api/csp-report;
report-to csp-endpoint;
```

### CSP Reporting

Violations are reported to `/api/csp-report` and the `Report-To` API endpoint with a 24-hour retention policy.

### Additional Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-XSS-Protection` | `0` | Disable legacy XSS auditor (can cause issues) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer information leakage |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforce HTTPS (production only) |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=(), interest-cohort=()` | Restrict browser APIs |

### CORS Configuration

Cross-origin requests are validated against the `ALLOWED_ORIGINS` environment variable. Origins are matched dynamically per request. CORS headers include `Access-Control-Allow-Credentials: true` with a 24-hour preflight cache.

Implementation: `src/proxy.ts` (see `addSecurityHeaders` and `getCorsHeaders`)

---

## Audit Logging

### Architecture

The audit system uses a **tamper-evident hash chain** to ensure log integrity. Each audit record includes:

- `recordHash`: SHA-256 hash of the record's content
- `previousHash`: Hash of the preceding record

This blockchain-like structure means that any modification to a historical record invalidates all subsequent hashes, making tampering detectable.

### Hash Chain Integrity

```
Record N-1                          Record N
+-------------------------+        +-------------------------+
| event, userId, ...      |        | event, userId, ...      |
| recordHash = SHA256(N-1)|<-------| previousHash = hash(N-1)|
+-------------------------+        | recordHash = SHA256(N)  |
                                   +-------------------------+
```

The `verifyHashChain()` function can verify up to 1,000 records, reporting broken links.

### Event Coverage

The system logs events across these categories:

**Authentication events:**
- User sign-in, sign-out, sign-up
- Failed authentication attempts
- MFA enable/disable
- Session revocation

**Authorization events:**
- Permission denied (with required and missing permissions)
- Role changes

**API key events:**
- API key creation, usage, and revocation
- Invalid key attempts
- IP and endpoint restriction violations

**Security events:**
- Account lockout and unlock
- Rate limit violations
- CSRF validation failures
- Session fingerprint mismatches
- Virus/malware detection in uploaded files
- Suspicious activity (CRITICAL severity)

**Data events:**
- Document upload, deletion
- Data export and erasure requests
- Encryption operations

### Severity Levels

| Severity | Retention | Examples |
|----------|-----------|----------|
| `INFO` | 90 days | Normal operations, document uploads |
| `WARNING` | 90 days | Permission denied, rate limit hits |
| `ERROR` | 1 year | Failed operations, system errors |
| `CRITICAL` | 1 year | Virus detected, security breaches |

### Partition-Based Cleanup

For high-volume deployments, the audit log supports PostgreSQL table partitioning. Old partitions are detached rather than deleted, avoiding table bloat and maintaining query performance.

### Anonymization

During GDPR data erasure, audit logs are anonymized rather than deleted to preserve the hash chain. The user ID is replaced with `anonymized-<base64>`, and PII fields (IP address, user agent, metadata) are cleared.

Implementation: `src/lib/audit/audit-logger.ts`, `src/lib/audit/hash-chain.ts`

---

## Account Security

### Multi-Factor Authentication (MFA)

MFA is implemented using **TOTP (Time-Based One-Time Passwords)** per RFC 6238.

**Configuration:**
- Issuer: RAG Starter Kit
- Period: 30 seconds
- Digits: 6

**Secret management:**
- TOTP secrets are encrypted at rest using the field-level encryption module (AES-256-GCM).
- Secrets are encrypted with the user ID as the entity key.
- Decryption occurs only during verification.

**Backup codes:**
- 10 backup codes are generated during MFA setup.
- Each code is 8 hex characters (32 bits of entropy).
- Codes are hashed with bcrypt (12 rounds) for storage.
- Used codes are removed from the list after successful verification.
- Verification uses `bcrypt.compare` with index tracking.

Implementation: `src/lib/security/mfa.ts`

### Account Lockout

Brute-force protection is enforced with exponential backoff:

| Parameter | Value |
|-----------|-------|
| Maximum failed attempts | 5 |
| Base lockout duration | 15 minutes |
| Maximum lockout duration | 24 hours |
| Attempt window | 1 hour |
| Backoff strategy | Exponential (15min, 30min, 1h, 2h, 4h...) |

Lockout records are stored in Redis with TTL-based auto-expiry. An in-memory fallback is used when Redis is unavailable. Lockout events are logged with severity `WARNING`, and manual admin unlocks are logged as audit events.

Implementation: `src/lib/security/account-lockout.ts`

### Password Policies

The password policy is enforced at both registration and password change endpoints via Zod validation:

- **Minimum length**: 12 characters
- **Maximum length**: 128 characters
- **Complexity requirements**: Uppercase, lowercase, digit, and special character
- **Storage**: bcrypt with 12 salt rounds

---

## API Security

### API Key Authentication

API keys provide programmatic access to the platform.

**Key format:** `rag_<48-byte-base64url-encoded-random>`

**Key lifecycle:**
1. Generated using `crypto.randomBytes(48)` with the `rag_` prefix.
2. Hashed with bcrypt (12 rounds) before database storage. Only the hash is stored; the plaintext key is shown once at creation.
3. A key preview (first 12 characters) is stored for identification purposes.
4. Keys can have optional expiration dates, IP allowlists (CIDR notation), and endpoint restrictions.

**Validation flow:**
1. Extract key from `Authorization: Bearer <key>` or `X-API-Key` header.
2. Look up key record by prefix in the database.
3. Check revocation status and expiration.
4. Verify the bcrypt hash (with caching for performance).
5. Check IP restrictions using CIDR matching.
6. Check endpoint restrictions.
7. Verify required permissions.
8. Update usage statistics (last used timestamp).
9. Log the API key usage as an audit event.

**Scoping:**
- Each API key is associated with a workspace and a set of permissions from the 18-permission model.
- IP restrictions support CIDR notation for network-level access control.
- Endpoint restrictions allow limiting keys to specific API paths.

**Security measures:**
- Invalid key attempts are logged as `SUSPICIOUS_ACTIVITY`.
- Revoked key usage attempts are logged with `CRITICAL` severity.
- IP and endpoint restriction violations are logged.
- Successful validations are cached with configurable TTL to reduce bcrypt overhead.

Implementation: `src/lib/security/api-keys.ts`

### Request Signing

All API responses include a unique `X-Request-ID` header for tracing. Request IDs are either propagated from the client's `X-Request-ID` header or generated as a UUID.

---

## Input Validation

### Zod Schema Validation

All user input is validated using Zod schemas before processing. Schemas are defined for every API endpoint:

- Chat input (messages, configuration, streaming options)
- Document ingestion (chunk size, overlap, file types)
- URL ingestion (URL validation, crawl depth limits)
- Workspace CRUD operations (name, slug, description, settings)
- Member management (email, role)
- API key management (name, permissions, IP allowlist, endpoint restrictions)
- User registration and login (email, password)
- Password changes (current and new password validation)
- Document search (query, pagination)
- Pagination parameters (page, page size with maximums)

### File Validation

Uploaded files are validated at multiple levels:

1. **MIME type checking**: Only allowed MIME types are accepted (PDF, DOCX, XLSX, PPTX, TXT, Markdown, HTML, audio, video).
2. **File size limit**: 50 MB maximum.
3. **Magic byte validation**: File contents are checked against expected byte signatures to prevent renamed file attacks (e.g., a `.exe` disguised as `.pdf`).
4. **Virus scanning**: Optional ClamAV integration for malware detection. Supports TCP, Unix socket, and mock backends. Infected files trigger `CRITICAL` severity audit events.

Implementation: `src/lib/security/virus-scanner.ts`

### HTML Sanitization

HTML content is sanitized using **DOMPurify** (server-side via jsdom):

- Allowed tags: structural and formatting elements only (no `<script>`, `<style>`, `<iframe>`, etc.)
- Allowed attributes: `href`, `title`, `class`, `id`
- Data attributes are stripped (`ALLOW_DATA_ATTR: false`)
- DOM clobbering protection enabled (`SANITIZE_DOM: true`)

Plain text input is sanitized by removing angle brackets, `javascript:` URLs, and event handler attributes.

### SSRF Protection

URL inputs (e.g., for URL-based document ingestion) are validated against SSRF attacks:

1. Protocol restricted to HTTP and HTTPS only.
2. Credentials in URLs are rejected.
3. Ports restricted to 80 and 443 unless explicitly allowed.
4. Blocked hostnames: `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`), Kubernetes internal hostnames.
5. Internal domain suffixes blocked: `.local`, `.internal`, `.localhost`, `.intranet`, `.corp`, `.lan`.
6. DNS resolution check: Hostname is resolved and all resulting IP addresses are checked against private IP ranges (RFC 1918, link-local, loopback, multicast, etc.).
7. Both IPv4 and IPv6 private ranges are covered.

Implementation: `src/lib/security/ssrf-protection.ts`, `src/lib/security/input-validator.ts`

---

## Infrastructure Security

### Deployment Platforms

| Component | Service | Notes |
|-----------|---------|-------|
| Application | Vercel or Railway | Edge functions, automatic HTTPS |
| Database | Managed PostgreSQL (Prisma Postgres, Supabase, or Railway) | TLS connections, automatic backups |
| Cache/Rate Limiting | Upstash Redis | REST API (Edge-compatible), TLS |
| File Storage | Cloudinary | Server-side encryption at rest |
| AI Models | OpenAI, OpenRouter, Google Gemini | TLS, API key authentication |
| Background Jobs | Inngest | TLS, signed webhooks |

### Environment Variable Security

- All secrets (`ENCRYPTION_MASTER_KEY`, `NEXTAUTH_SECRET`, `CSRF_SECRET`, database URLs, API keys) are stored in the platform's encrypted environment variable store.
- Production deployments validate that `ENCRYPTION_MASTER_KEY` is set and at least 32 characters.
- Development-only fallbacks are explicitly marked and fail closed in production.

### Network Security

- All external communication uses HTTPS/TLS.
- HSTS is enforced with a 1-year max-age, includeSubDomains, and preload.
- `X-Frame-Options: DENY` prevents framing (clickjacking protection).
- CORS is restricted to explicitly allowed origins.
- WebSocket connections are restricted to known services (Vercel, Inngest).

---

## Encryption Key Rotation

`ENCRYPTION_MASTER_KEY` is used to encrypt sensitive values at rest (SAML private keys, webhook secrets, TOTP secrets, OAuth tokens stored in the database). It is required in production and validated at startup.

### Generating a Key

```bash
openssl rand -base64 32
```

Store the output in the `ENCRYPTION_MASTER_KEY` environment variable (minimum 32 characters).

### Rotation Procedure

Key rotation must re-encrypt all values encrypted with the old key before the old key is removed. The following procedure achieves zero-downtime rotation:

**Step 1 -- Dual-key phase.** Add the new key as `ENCRYPTION_MASTER_KEY_NEW` while keeping `ENCRYPTION_MASTER_KEY` unchanged. Deploy.

**Step 2 -- Re-encryption.** Run the migration script that reads each encrypted value with the old key and re-writes it with the new key:

```bash
# Dry-run first
bun tsx scripts/rotate-encryption-key.ts --dry-run

# Apply
bun tsx scripts/rotate-encryption-key.ts
```

This script must iterate over all tables that store encrypted columns (currently: `saml_providers.private_key`, `webhooks.secret`, and TOTP secrets stored via the field-encryption module).

**Step 3 -- Promote.** Set `ENCRYPTION_MASTER_KEY` to the new key value and remove `ENCRYPTION_MASTER_KEY_NEW`. Deploy.

**Step 4 -- Verify.** Confirm all encrypted services (SAML SSO, webhooks, API key verification, MFA) work correctly before decommissioning the old key.

### What Not to Do

- **Never** delete `ENCRYPTION_MASTER_KEY` before re-encryption is complete -- all encrypted values become permanently unreadable.
- **Never** commit the key to version control. Use a secrets manager (AWS Secrets Manager, Doppler, Vercel Environment Variables).
- **Never** reuse an old key after rotation.

### Emergency Key Loss

If the master key is lost, there is no recovery path for encrypted values. Affected rows must be invalidated (API keys revoked, SAML configs deleted, webhooks disabled, MFA reset) and re-provisioned by users.

---

## Vulnerability Reporting

Report security vulnerabilities via [GitHub Security Advisories](https://github.com/rejisterjack/rag-starter-kit/security/advisories/new).

Do **not** open a public GitHub issue for security vulnerabilities. Security advisories allow coordinated disclosure and give maintainers time to patch before public disclosure.
