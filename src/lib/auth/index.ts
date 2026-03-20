import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare, hash } from 'bcryptjs';
import type { DefaultSession } from 'next-auth';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { createDefaultWorkspace, getUserWorkspaces } from '@/lib/workspace/workspace';

// =============================================================================
// Type Extensions
// =============================================================================

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

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    workspaceId?: string;
    workspaceRole?: string;
  }
}

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
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      // allowDangerousEmailAccountLinking is intentionally NOT enabled
      // to prevent OAuth account takeover attacks
    }),

    // Google OAuth Provider
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
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

    // Email/Password Credentials Provider
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

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
          return null;
        }

        // Verify password
        const isValid = await compare(password, user.password);

        if (!isValid) {
          return null;
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

        // Get user's first workspace for default
        const workspaces = await getUserWorkspaces(user.id!);
        if (workspaces.length > 0) {
          token.workspaceId = workspaces[0].id;
          const member = workspaces[0].members.find((m) => m.userId === user.id);
          token.workspaceRole = member?.role ?? 'MEMBER';
        }
      }

      // Handle session updates
      if (trigger === 'update' && session?.workspaceId) {
        token.workspaceId = session.workspaceId;
        // Get role in new workspace
        const member = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId: session.workspaceId,
            userId: token.id!,
          },
        });
        token.workspaceRole = member?.role ?? 'MEMBER';
      }

      return token;
    },

    // Session Callback - Attach user data to session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id!;
        session.user.role = token.role ?? 'USER';
        session.user.workspaceId = token.workspaceId;
        session.user.workspaceRole = token.workspaceRole;
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
      console.log('New user created:', user.email);

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
        } catch (error) {
          console.error('Failed to create default workspace:', error);
        }
      }
    },

    // Handle successful sign-in
    async signIn({ user, account }) {
      console.log('User signed in:', user.email, 'via', account?.provider);

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

    return { success: true, userId: user.id };
  } catch (error) {
    console.error('Registration error:', error);
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

    // Log password change
    await logAuditEvent({
      event: AuditEvent.PASSWORD_CHANGED,
      userId,
    });

    return { success: true };
  } catch (error) {
    console.error('Password change error:', error);
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
