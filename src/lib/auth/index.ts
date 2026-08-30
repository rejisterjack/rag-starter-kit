/**
 * @fileoverview Authentication Module - NextAuth.js v5 implementation
 *
 * Provides comprehensive authentication including:
 * - OAuth providers (GitHub, Google)
 * - Email/password credentials
 * - SAML 2.0 SSO for enterprise
 * - API key authentication
 * - JWT-based sessions with workspace context
 *
 * ## Features
 *
 * - **Multi-provider OAuth**: GitHub, Google with secure account linking
 * - **SAML SSO**: Enterprise single sign-on (Okta, Azure AD, OneLogin)
 * - **Session Management**: JWT-based with automatic refresh
 * - **Workspace Context**: Sessions include active workspace and role
 * - **Audit Logging**: All auth events logged for compliance
 *
 * ## Usage
 *
 * ```typescript
 * import { auth, signIn, signOut } from '@/lib/auth';
 *
 * // In server components
 * const session = await auth();
 * if (!session) redirect('/login');
 *
 * // In API routes
 * const session = await auth();
 * const userId = session?.user?.id;
 *
 * // Sign in
 * await signIn('github');
 * await signIn('credentials', { email, password });
 * ```
 *
 * @module auth
 * @requires next-auth
 * @requires @auth/prisma-adapter
 * @see {@link https://authjs.dev/|Auth.js Documentation}
 */

import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import type { DefaultSession } from 'next-auth';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { cache } from 'react';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { consumeMfaCompletionToken, createMfaChallengeToken } from '@/lib/auth/mfa-challenge';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';
import {
  getLockoutStatus,
  recordFailedAttempt,
  recordSuccessfulLogin,
} from '@/lib/security/account-lockout';
import { isSessionRevoked, trackSession } from '@/lib/security/session-store';
import { createDefaultWorkspace, getAppUrl, getUserWorkspaces } from '@/lib/workspace/workspace';
import { authConfig } from './auth.config';

// =============================================================================
// Env Validation
// =============================================================================

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// =============================================================================
// Type Extensions
// =============================================================================

export interface AuthSession {
  user: {
    id: string;
    role: string;
    workspaceId?: string;
    workspaceRole?: string;
  } & DefaultSession['user'];
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      workspaceId?: string;
      workspaceRole?: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
  }
}

// Note: next-auth/jwt module augmentation removed due to compatibility issues
// JWT types are handled via type assertions

// =============================================================================
// Session Revocation Cache (avoids Redis round-trip on every request)
// =============================================================================

const revocationCache = new Map<string, { revoked: boolean; expiry: number }>();

async function isSessionRevokedCached(jti: string): Promise<boolean> {
  const cached = revocationCache.get(jti);
  if (cached && cached.expiry > Date.now()) return cached.revoked;

  const revoked = await isSessionRevoked(jti).catch(() => false);

  // If revoked, cache for the full session TTL; if not, cache for 5 seconds
  const ttl = revoked ? 7 * 24 * 60 * 60 * 1000 : 5000;
  revocationCache.set(jti, { revoked, expiry: Date.now() + ttl });

  // Prevent memory leak: prune expired entries when cache grows large
  if (revocationCache.size > 10000) {
    const now = Date.now();
    for (const [key, val] of revocationCache) {
      if (val.expiry <= now) revocationCache.delete(key);
    }
  }

  return revoked;
}

// =============================================================================
// NextAuth Configuration
// =============================================================================

const {
  handlers: { GET, POST },
  auth: _auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days - reduced from 30 for security
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    // OAuth providers are only registered when credentials are configured.
    // This keeps AUTH_CREDENTIALS_ONLY=true environments (CI, credentials-only
    // deployments) bootable instead of crashing on missing env vars at import.
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? [
          // GitHub OAuth Provider
          GitHub({
            clientId: requireEnv('AUTH_GITHUB_ID'),
            clientSecret: requireEnv('AUTH_GITHUB_SECRET'),
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope: 'read:user user:email',
              },
            },
            userinfo: {
              url: 'https://api.github.com/user',
              async request({ tokens }: { tokens: { access_token: string } }) {
                const headers = { Authorization: `Bearer ${tokens.access_token}` };

                const profileRes = await fetch('https://api.github.com/user', { headers });
                const profile = await profileRes.json();

                // Fetch emails if profile doesn't have a public one
                if (!profile.email) {
                  try {
                    const emailsRes = await fetch('https://api.github.com/user/emails', {
                      headers,
                    });
                    const emails = await emailsRes.json();
                    if (Array.isArray(emails)) {
                      const primary = emails.find(
                        (e: { primary: boolean; verified: boolean }) => e.primary && e.verified
                      );
                      if (primary) profile.email = primary.email;
                    }
                  } catch {
                    // Email endpoint unavailable — will be caught by missing email check below
                  }
                }

                // Last resort: use login@users.noreply.github.com if email still missing
                if (!profile.email && profile.login) {
                  profile.email = `${profile.login}@users.noreply.github.com`;
                }

                return profile;
              },
            },
          }),
        ]
      : []),

    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          // Google OAuth Provider
          Google({
            clientId: requireEnv('AUTH_GOOGLE_ID'),
            clientSecret: requireEnv('AUTH_GOOGLE_SECRET'),
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),

    // Email/Password Credentials Provider with Account Lockout
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaCompletionToken: { label: 'MFA Completion Token', type: 'text' },
      },
      async authorize(credentials, req) {
        // Complete MFA login with one-time completion token (after TOTP verified)
        if (credentials?.mfaCompletionToken) {
          const userId = consumeMfaCompletionToken(credentials.mfaCompletionToken as string);
          if (!userId) return null;

          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
              workspaceMembers: {
                include: { workspace: true },
                take: 1,
                orderBy: { joinedAt: 'asc' },
              },
            },
          });

          if (!user) return null;

          await logAuditEvent({
            event: AuditEvent.USER_LOGIN,
            userId: user.id,
            metadata: { method: 'credentials', mfa: true },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
          };
        }

        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Check if account is locked
        const lockoutStatus = await getLockoutStatus(email);
        if (lockoutStatus.isLocked) {
          // Log blocked login attempt
          await logAuditEvent({
            event: AuditEvent.SUSPICIOUS_ACTIVITY,
            metadata: {
              activity: 'login_blocked_due_to_lockout',
              email,
              lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
            },
            severity: 'WARNING',
          });

          throw new Error(
            JSON.stringify({
              code: 'ACCOUNT_LOCKED',
              lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
              retryAfterSeconds: Math.max(
                0,
                Math.ceil(((lockoutStatus.lockedUntil?.getTime() ?? 0) - Date.now()) / 1000)
              ),
            })
          );
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            workspaceMembers: {
              include: { workspace: true },
              take: 1,
              orderBy: { joinedAt: 'asc' },
            },
          },
        });

        if (!user?.password) {
          // Record failed attempt
          // FIXED: Use Headers.get() instead of bracket notation
          const ipAddress = req?.headers?.get('x-forwarded-for') ?? undefined;
          await recordFailedAttempt(email, ipAddress);
          return null;
        }

        // Verify password
        const isValid = await compare(password, user.password);

        if (!isValid) {
          // Record failed attempt
          // FIXED: Use Headers.get() instead of bracket notation
          const ipAddress = req?.headers?.get('x-forwarded-for') ?? undefined;
          const newStatus = await recordFailedAttempt(email, ipAddress);

          // If this attempt locked the account, throw error
          if (newStatus.isLocked) {
            throw new Error(`ACCOUNT_LOCKED:${newStatus.lockedUntil?.getTime() || 0}`);
          }

          return null;
        }

        // Record successful login (resets failed attempts)
        await recordSuccessfulLogin(email);

        // Check if MFA is required — block session until TOTP verified
        if (user.mfaEnabled) {
          const challengeToken = createMfaChallengeToken(user.id);
          throw new Error(`MFA_REQUIRED:${challengeToken}`);
        }

        // Log successful login
        await logAuditEvent({
          event: AuditEvent.USER_LOGIN,
          userId: user.id,
          metadata: { method: 'credentials' },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    // JWT Callback - Add custom claims to token
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? 'USER';

        // Generate a unique JTI for session revocation tracking
        token.jti = crypto.randomUUID();

        // Get user's first workspace for default
        const workspaces = await getUserWorkspaces(user.id ?? '');
        if (workspaces.length > 0) {
          token.workspaceId = workspaces[0].id;
          const member = workspaces[0].members.find(
            (m: { userId: string }) => m.userId === user.id
          );
          token.workspaceRole = member?.role ?? 'MEMBER';
        }

        // Track the new session
        if (user.id) {
          await trackSession(user.id, token.jti as string).catch(() => {});
        }
      }

      // Handle session updates
      if (trigger === 'update' && session?.workspaceId) {
        token.workspaceId = session.workspaceId;
        // Get role in new workspace
        const member = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId: session.workspaceId,
            userId: token.id ?? '',
          },
        });
        token.workspaceRole = member?.role ?? 'MEMBER';
      }

      return token;
    },

    // Session Callback - Attach user data to session and check revocation
    async session({ session, token }) {
      if (token && session.user) {
        // Check if session has been revoked (with caching to avoid Redis on every request)
        const jti = typeof token.jti === 'string' ? token.jti : null;
        if (jti) {
          const revoked = await isSessionRevokedCached(jti);
          if (revoked) {
            // Force re-authentication by returning a session with no user
            const emptySession = { ...session, user: { id: '', role: 'USER' } };
            return emptySession as typeof session;
          }
        }

        session.user.id = typeof token.id === 'string' ? token.id : '';
        session.user.role = typeof token.role === 'string' ? token.role : 'USER';
        session.user.workspaceId =
          typeof token.workspaceId === 'string' ? token.workspaceId : undefined;
        session.user.workspaceRole =
          typeof token.workspaceRole === 'string' ? token.workspaceRole : undefined;
      }
      return session;
    },

    // Sign In Callback - Additional validation
    async signIn({ account }) {
      // Allow OAuth sign-ins
      if (account?.provider === 'github' || account?.provider === 'google') {
        return true;
      }

      // Allow credentials sign-in (already validated in authorize)
      if (account?.provider === 'credentials') {
        return true;
      }

      return false;
    },
  },

  events: {
    // Handle new user creation
    async createUser({ user }) {
      // Create default workspace for new user
      if (user.id) {
        try {
          await createDefaultWorkspace(user.id, {
            name: user.name ? `${user.name}'s Workspace` : 'My Workspace',
          });

          await logAuditEvent({
            event: AuditEvent.USER_REGISTERED,
            userId: user.id,
            metadata: { email: user.email, provider: 'oauth' },
          });

          // Send welcome email (fire-and-forget)
          try {
            const appUrl = getAppUrl();
            const userEmail = user.email;
            if (userEmail) {
              await emailService.sendEmail({
                to: userEmail,
                template: emailService.welcomeEmail(
                  user.name || userEmail.split('@')[0],
                  `${appUrl}/login`
                ),
              });
            }
          } catch (emailError) {
            logger.error('Failed to send welcome email', {
              error: emailError instanceof Error ? emailError.message : 'Unknown',
            });
          }
        } catch (error) {
          logger.error('Failed to create default workspace', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
    },

    // Handle successful sign-in
    async signIn({ user, account }) {
      // Log OAuth sign-ins
      if (account?.provider !== 'credentials' && user.id) {
        await logAuditEvent({
          event: AuditEvent.USER_LOGIN,
          userId: user.id,
          metadata: { provider: account?.provider },
        });
      }
    },
  },

  // Debug mode in development
  debug: false,
});

// =============================================================================
// Cached auth for request-level deduplication
// =============================================================================

// Within a single server render or API handler, auth() may be called multiple
// times. React's cache() deduplicates the calls so the session is resolved once.
export const auth = cache(_auth);
export { GET, POST, signIn, signOut };

// =============================================================================
// Re-exports from session.ts for backward compatibility
// Consumers can import from '@/lib/auth' or '@/lib/auth/session'
// =============================================================================

export {
  getCurrentUser,
  getCurrentUserId,
  getCurrentWorkspaceId,
  getServerSession,
  requireAdmin,
  requireAuth,
  withApiAuth,
} from './session';
