# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it to us as soon as possible.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@example.com**

Please include:
- A description of the vulnerability
- Steps to reproduce the issue
- Possible impact of the vulnerability
- Any suggestions for fixing it (if you have them)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Investigation**: We will investigate the issue and determine its impact
- **Updates**: We will keep you updated on our progress
- **Resolution**: Once fixed, we will notify you and publicly acknowledge your contribution (if desired)

### Security Measures in Place

This project implements the following security measures:

- **Authentication**: NextAuth.js v5 with secure session management
- **Authorization**: Role-based access control (RBAC) for workspaces
- **Data Isolation**: Row-level security with userId/workspaceId filtering
- **Input Validation**: Zod schema validation on all inputs
- **Rate Limiting**: Redis-based rate limiting (Upstash or Docker Redis)
- **Audit Logging**: Comprehensive audit trail for sensitive operations
- **Secure Storage**: Environment variables for secrets, never commit credentials
- **TypeScript**: Strict type checking to prevent runtime errors

### Best Practices for Users

1. **Keep dependencies updated**: Run `pnpm audit` regularly
2. **Use strong secrets**: Generate secure random strings for `NEXTAUTH_SECRET`
3. **Enable HTTPS**: Always use HTTPS in production
4. **Configure CORS properly**: Restrict origins in production
5. **Monitor logs**: Check for suspicious activity
6. **Use API keys**: Rotate keys regularly

## Security Features

### Authentication & Authorization
- JWT tokens with secure expiration
- OAuth providers (GitHub, Google) with PKCE
- Session invalidation on logout
- Workspace-level permissions

### Data Protection
- Database connections use SSL/TLS
- Sensitive data encrypted at rest (S3)
- Vector embeddings don't contain raw text
- Audit logs for compliance

### API Security
- Rate limiting per user/IP
- Input sanitization
- SQL injection prevention (Prisma ORM)
- XSS protection (React's built-in escaping)
- CSRF protection (NextAuth.js)

## Known Limitations

- File uploads are scanned client-side only (ClamAV integration is optional)
- Rate limits depend on Redis availability
- Document content is stored in plain text in the database

## Acknowledgments

We thank the following security researchers who have responsibly disclosed vulnerabilities:

- [Your name could be here!]
