# Security Policy

## Supported Versions

Only the latest release receives security fixes. We recommend always running the most recent version.

| Version | Supported |
|---------|-----------|
| 1.x (latest) | ✅ Yes |
| < 1.0 | ❌ No |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities in public GitHub issues.**

If you discover a security vulnerability, report it privately so it can be assessed and patched before it's disclosed publicly.

### How to Report

Open a [GitHub Security Advisory](https://github.com/rejisterjack/rag-starter-kit/security/advisories/new) — this is the preferred method. It creates a private discussion between you and the maintainers.

Alternatively, email **rupam[at]rejisterjack[dot]dev** with:
- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested fix (optional but appreciated)

### What to Expect

- **Acknowledgement** within 48 hours
- **Initial assessment** within 5 business days
- **Fix timeline** communicated once the severity is understood
- **Credit** in the security advisory and changelog (unless you prefer to remain anonymous)

---

## Security Model

### What This Project Handles

`rag-starter-kit` is a self-hosted application. When you deploy it, you own the infrastructure. This means:

- **Your documents stay on your servers** — nothing is sent to third parties except the LLM API calls you configure (OpenRouter, Google Gemini, or whichever provider you choose)
- **Authentication** is handled by NextAuth.js v5 — we don't implement our own auth cryptography
- **Database access** is scoped by workspace — users cannot access other workspaces' documents or conversations

### What This Project Does NOT Handle

- Physical security of your deployment infrastructure
- Network-level security (firewalls, VPNs, DDoS protection)
- Compliance certifications (SOC2, HIPAA, GDPR) — this is a self-hosted project; compliance is your responsibility based on your deployment

---

## Built-in Security Features

### Authentication & Authorization
- **NextAuth.js v5** with OAuth (GitHub, Google) and credentials
- **API key authentication** for programmatic access
- **Role-based access control** at the workspace level
- **Session management** with secure, HttpOnly cookies

### Input & Data Validation
- **Zod schemas** validate all API inputs — malformed requests are rejected before touching the database
- **Prisma ORM** prevents SQL injection — no raw query strings with user input
- **React's built-in escaping** prevents XSS in rendered output
- **File type validation** on document uploads — only allowed MIME types are accepted

### Rate Limiting & Abuse Prevention
- **Per-endpoint rate limiting** via Upstash Redis
- **Progressive penalties** for repeated violations
- **Audit logging** for authentication events, document uploads, and admin actions

### HTTP Security Headers
- `Content-Security-Policy` — restricts resource loading
- `Strict-Transport-Security` — enforces HTTPS
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## Deployment Security Checklist

If you're deploying this to production, run through this before going live:

**Environment Variables**
- [ ] `NEXTAUTH_SECRET` is a cryptographically random 32+ character string (generate with `openssl rand -base64 32`)
- [ ] Database credentials are strong and not the Docker defaults
- [ ] MinIO credentials are changed from `minioadmin/minioadmin`
- [ ] All API keys are scoped to the minimum required permissions

**Infrastructure**
- [ ] The app runs behind HTTPS (Vercel handles this automatically; self-hosted needs a reverse proxy with TLS)
- [ ] The PostgreSQL port (5432) is not publicly exposed
- [ ] The Redis port (6379) is not publicly exposed
- [ ] The MinIO port (9000/9001) is not publicly exposed unless required

**Authentication**
- [ ] OAuth callback URLs are locked to your production domain
- [ ] `NEXTAUTH_URL` matches your actual production URL exactly

---

## Responsible Disclosure

We follow responsible disclosure. If you report a vulnerability:

1. We will work with you to understand and reproduce the issue
2. We will develop and test a fix privately
3. We will release the fix and publish a security advisory simultaneously
4. We will credit you in the advisory unless you prefer otherwise

We ask that you:
1. Give us reasonable time to fix the issue before public disclosure
2. Not exploit the vulnerability beyond what's needed to demonstrate it
3. Not access or modify data that isn't yours

---

*This policy was last updated May 2026.*
