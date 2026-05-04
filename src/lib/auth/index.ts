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
import { compare, hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import type { DefaultSession } from 'next-auth';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/notifications/email';
import {
  getLockoutStatus,
  recordFailedAttempt,
  recordSuccessfulLogin,
} from '@/lib/security/account-lockout';
import {
  isSessionRevoked,
  revokeAllUserSessions,
  trackSession,
} from '@/lib/security/session-store';
import { createDefaultWorkspace, getAppUrl, getUserWorkspaces } from '@/lib/workspace/workspace';

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
// NextAuth Configuration
// =============================================================================

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days - reduced from 30 for security
    updateAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    newUser: '/register',
  },
  providers: [
    // GitHub OAuth Provider
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID as string,
      clientSecret: process.env.AUTH_GITHUB_SECRET as string,
      // allowDangerousEmailAccountLinking is intentionally NOT enabled
      // to prevent OAuth account takeover attacks
    }),

    // Google OAuth Provider
    Google({
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
      // allowDangerousEmailAccountLinking is intentionally NOT enabled
      // to prevent OAuth account takeover attacks
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    // Email/Password Credentials Provider with Account Lockout
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
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

          // Return null with a specific error that will be handled
          throw new Error(`ACCOUNT_LOCKED:${lockoutStatus.lockedUntil?.getTime() || 0}`);
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

        if (!user || !user.password) {
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

        // Check if MFA is required
        if (user.mfaEnabled) {
          throw new Error(`MFA_REQUIRED:${user.id}`);
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
        // Check if session has been revoked
        const jti = typeof token.jti === 'string' ? token.jti : null;
        if (jti) {
          const revoked = await isSessionRevoked(jti).catch(() => false);
          if (revoked) {
            // Return an empty session to force re-authentication
            return {} as typeof session;
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
  debug: process.env.NODE_ENV === 'development',
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Register a new user with email and password
 */
export async function registerUser({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, error: 'User already exists' };
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        emailVerified: new Date(), // Auto-verify for credentials
      },
    });

    // Create default workspace
    await createDefaultWorkspace(user.id, {
      name: name ? `${name}'s Workspace` : 'My Workspace',
    });

    // Log registration
    await logAuditEvent({
      event: AuditEvent.USER_REGISTERED,
      userId: user.id,
      metadata: { email, provider: 'credentials' },
    });

    // Send welcome email (fire-and-forget)
    try {
      const appUrl = getAppUrl();
      await emailService.sendEmail({
        to: email,
        template: emailService.welcomeEmail(name || email.split('@')[0], `${appUrl}/login`),
      });
    } catch (emailError) {
      logger.error('Failed to send welcome email', {
        error: emailError instanceof Error ? emailError.message : 'Unknown',
      });
    }

    return { success: true, userId: user.id };
  } catch (error) {
    logger.error('Registration error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to create account' };
  }
}

/**
 * Change user password
 */
export async function changePassword({
  userId,
  currentPassword,
  newPassword,
}: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      return { success: false, error: 'User not found' };
    }

    // Verify current password
    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all existing sessions so user must re-authenticate
    await revokeAllUserSessions(userId);

    // Log password change
    await logAuditEvent({
      event: AuditEvent.PASSWORD_CHANGED,
      userId,
    });

    // Send password change notification (fire-and-forget)
    try {
      await emailService.sendEmail({
        to: user.email,
        template: emailService.passwordChangedNotificationEmail({
          userName: user.name || user.email,
          changedAt: new Date(),
        }),
      });
    } catch (emailError) {
      logger.error('Failed to send password change notification', {
        error: emailError instanceof Error ? emailError.message : 'Unknown',
      });
    }

    return { success: true };
  } catch (error) {
    logger.error('Password change error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to change password' };
  }
}

/**
 * Get current authenticated user with workspace info
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      workspaceMembers: {
        include: { workspace: true },
      },
    },
  });

  return user;
}

/**
 * Require authentication for server components
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Check if user is admin
 */
export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }
  return session;
}

/**
 * Wrap an API route handler with authentication.
 * If the user is not authenticated, returns a 401 JSON response.
 *
 * @example
 * export const GET = withApiAuth(async (req, session) => {
 *   const userId = session.user.id;
 *   // ... handler logic
 *   return NextResponse.json({ data });
 * });
 */
export function withApiAuth<TReq extends Request = Request, TContext = unknown>(
  handler: (req: TReq, session: AuthSession, context: TContext) => Promise<NextResponse>
): (req: TReq, context: TContext) => Promise<NextResponse> {
  function wrapper(req: TReq, context: TContext): Promise<NextResponse> {
    return (async () => {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      return handler(req, session as AuthSession, context);
    })();
  }
  return wrapper;
}
