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
- MinIO/S3 with server-side encryption
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

## Vulnerability Reporting

Email security issues to: security@example.com
