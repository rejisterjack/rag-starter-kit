/**
 * Edge-Compatible Auth Configuration
 *
 * Used by middleware (Edge Runtime) for JWT decoding without database access.
 * The full auth config in index.ts extends this with the Prisma adapter,
 * providers, and database-dependent callbacks.
 *
 * @see https://authjs.dev/getting-started/migrating-to-v5
 */

import type { NextAuthConfig } from 'next-auth';

const isProduction = process.env.NODE_ENV === 'production';

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  // Must match src/lib/auth/index.ts so edge middleware can read the session
  // cookie that Node Auth.js writes (`next-auth.session-token`, not Auth.js v5's
  // default `authjs.session-token`).
  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    newUser: '/register',
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = typeof token.id === 'string' ? token.id : '';
        session.user.role = typeof token.role === 'string' ? token.role : 'USER';
        session.user.workspaceId =
          typeof token.workspaceId === 'string' ? token.workspaceId : undefined;
        session.user.workspaceRole =
          typeof token.workspaceRole === 'string' ? token.workspaceRole : undefined;
      }
      return session;
    },
  },
};
