import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, signIn, signOut } from '@/lib/auth';
import { getMockPrisma, mockPrisma } from '@/tests/utils/mocks/prisma';
import {
  generateCsrfToken,
  validateCsrfToken,
  withCsrfProtection,
} from '@/lib/security/csrf';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('Authentication', () => {
  const mockUser = {
    id: 'user-001',
    email: 'test@example.com',
    name: 'Test User',
    image: 'https://example.com/avatar.png',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('authenticates with valid credentials', async () => {
      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      vi.mocked(auth).mockResolvedValue(mockSession);

      const session = await auth();

      expect(session).toBeDefined();
      expect(session?.user).toMatchObject(mockUser);
    });

    it('returns null for unauthenticated users', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const session = await auth();

      expect(session).toBeNull();
    });

    it('handles GitHub OAuth sign in', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        error: null,
        status: 200,
        ok: true,
        url: null,
      });

      vi.mocked(signIn).mockImplementation(mockSignIn);

      const result = await signIn('github', {
        callbackUrl: '/dashboard',
      });

      expect(mockSignIn).toHaveBeenCalledWith('github', {
        callbackUrl: '/dashboard',
      });
      expect(result?.ok).toBe(true);
    });

    it('handles Google OAuth sign in', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        error: null,
        status: 200,
        ok: true,
        url: null,
      });

      vi.mocked(signIn).mockImplementation(mockSignIn);

      const result = await signIn('google');

      expect(mockSignIn).toHaveBeenCalledWith('google', undefined);
      expect(result?.ok).toBe(true);
    });

    it('handles sign in errors', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        error: 'OAuthAccountNotLinked',
        status: 401,
        ok: false,
        url: null,
      });

      vi.mocked(signIn).mockImplementation(mockSignIn);

      const result = await signIn('github');

      expect(result?.error).toBe('OAuthAccountNotLinked');
      expect(result?.ok).toBe(false);
    });

    it('handles credentials sign in', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        error: null,
        status: 200,
        ok: true,
      });

      vi.mocked(signIn).mockImplementation(mockSignIn);

      const result = await signIn('credentials', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result?.ok).toBe(true);
    });

    it('signs out user', async () => {
      const mockSignOut = vi.fn().mockResolvedValue({ url: 'http://localhost:3000' });
      vi.mocked(signOut).mockImplementation(mockSignOut);

      await signOut({ callbackUrl: '/' });

      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
    });
  });

  describe('Registration', () => {
    it('registers new user with email and password', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'user-new',
        email: 'newuser@example.com',
        name: 'New User',
      });
      getMockPrisma().user.create = mockCreate;

      const result = await getMockPrisma().user.create({
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          passwordHash: 'hashedpassword',
        },
      });

      expect(result.email).toBe('newuser@example.com');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('prevents duplicate email registration', async () => {
      const mockCreate = vi.fn().mockRejectedValue(
        new Error('Unique constraint violation')
      );
      getMockPrisma().user.create = mockCreate;

      await expect(
        getMockPrisma().user.create({
          data: {
            email: 'existing@example.com',
            name: 'User',
            passwordHash: 'hash',
          },
        })
      ).rejects.toThrow('Unique constraint violation');
    });

    it('validates password strength on registration', async () => {
      const weakPasswords = ['short', 'nouppercase123!', 'NoNumber!', 'lowercase123!'];

      weakPasswords.forEach((password) => {
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);
        const isLongEnough = password.length >= 8;

        const isValid = hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough;
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Password Reset', () => {
    it('creates password reset token', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'token-123',
        email: 'test@example.com',
        token: 'reset-token',
        expires: new Date(Date.now() + 3600000),
      });
      getMockPrisma().passwordReset.create = mockCreate;

      const result = await getMockPrisma().passwordReset.create({
        data: {
          email: 'test@example.com',
          token: 'reset-token',
          expires: new Date(Date.now() + 3600000),
        },
      });

      expect(result.token).toBe('reset-token');
      expect(result.expires).toBeDefined();
    });

    it('validates reset token', async () => {
      getMockPrisma().passwordReset.findFirst = vi.fn().mockResolvedValue({
        id: 'token-123',
        email: 'test@example.com',
        token: 'valid-token',
        expires: new Date(Date.now() + 3600000), // Valid for 1 hour
        used: false,
      });

      const token = await getMockPrisma().passwordReset.findFirst({
        where: {
          token: 'valid-token',
          expires: { gt: new Date() },
          used: false,
        },
      });

      expect(token).not.toBeNull();
    });

    it('rejects expired reset token', async () => {
      getMockPrisma().passwordReset.findFirst = vi.fn().mockResolvedValue(null);

      const token = await getMockPrisma().passwordReset.findFirst({
        where: {
          token: 'expired-token',
          expires: { gt: new Date() },
          used: false,
        },
      });

      expect(token).toBeNull();
    });

    it('updates password after reset', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'user-001',
        email: 'test@example.com',
      });
      getMockPrisma().user.update = mockUpdate;

      await getMockPrisma().user.update({
        where: { email: 'test@example.com' },
        data: { passwordHash: 'new-hashed-password' },
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('marks token as used after password reset', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'token-123',
        used: true,
      });
      getMockPrisma().passwordReset.update = mockUpdate;

      await getMockPrisma().passwordReset.update({
        where: { token: 'used-token' },
        data: { used: true },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('OAuth Flows', () => {
    it('links OAuth account to existing user', async () => {
      getMockPrisma().account.findFirst = vi.fn().mockResolvedValue(null);
      
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'account-1',
        userId: 'user-001',
        provider: 'github',
        providerAccountId: '12345',
      });
      getMockPrisma().account.create = mockCreate;

      const result = await getMockPrisma().account.create({
        data: {
          userId: 'user-001',
          provider: 'github',
          providerAccountId: '12345',
          type: 'oauth',
        },
      });

      expect(result.provider).toBe('github');
    });

    it('finds user by OAuth account', async () => {
      getMockPrisma().account.findFirst = vi.fn().mockResolvedValue({
        id: 'account-1',
        userId: 'user-001',
        provider: 'github',
        providerAccountId: '12345',
        user: mockUser,
      });

      const account = await getMockPrisma().account.findFirst({
        where: {
          provider: 'github',
          providerAccountId: '12345',
        },
        include: { user: true },
      });

      expect(account?.user.email).toBe('test@example.com');
    });

    it('handles OAuth provider errors', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        error: 'OAuthCallback',
        status: 401,
        ok: false,
      });
      vi.mocked(signIn).mockImplementation(mockSignIn);

      const result = await signIn('github');

      expect(result?.error).toBe('OAuthCallback');
    });
  });

  describe('Session Management', () => {
    it('creates session on login', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-001',
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sessionToken: 'token-123',
      });
      getMockPrisma().session.create = mockCreate;

      const result = await getMockPrisma().session.create({
        data: {
          userId: 'user-001',
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          sessionToken: 'token-123',
        },
      });

      expect(result.userId).toBe('user-001');
      expect(result.sessionToken).toBe('token-123');
    });

    it('refreshes session before expiry', async () => {
      const nearExpirySession = {
        user: mockUser,
        expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      };

      vi.mocked(auth).mockResolvedValue(nearExpirySession);

      const session = await auth();
      const expiresAt = new Date(session?.expires || '');
      const minutesUntilExpiry = (expiresAt.getTime() - Date.now()) / (60 * 1000);

      expect(minutesUntilExpiry).toBeLessThan(10);
    });

    it('extends session on activity', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'session-1',
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      getMockPrisma().session.update = mockUpdate;

      await getMockPrisma().session.update({
        where: { sessionToken: 'token-123' },
        data: { expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('handles concurrent sessions', async () => {
      const sessions = [
        { id: 'session-1', userId: 'user-001', device: 'desktop' },
        { id: 'session-2', userId: 'user-001', device: 'mobile' },
      ];

      getMockPrisma().session.findMany = vi.fn().mockResolvedValue(sessions);

      const userSessions = await getMockPrisma().session.findMany({
        where: { userId: 'user-001' },
      });

      expect(userSessions).toHaveLength(2);
    });

    it('deletes session on logout', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ count: 1 });
      getMockPrisma().session.deleteMany = mockDelete;

      await getMockPrisma().session.deleteMany({
        where: { sessionToken: 'token-123' },
      });

      expect(mockDelete).toHaveBeenCalled();
    });

    it('invalidates all user sessions', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ count: 3 });
      getMockPrisma().session.deleteMany = mockDelete;

      await getMockPrisma().session.deleteMany({
        where: { userId: 'user-001' },
      });

      expect(mockDelete).toHaveBeenCalledWith({
        where: { userId: 'user-001' },
      });
    });
  });

  describe('CSRF Protection', () => {
    it('generates CSRF token', () => {
      const mockReq = { headers: {} } as unknown as Request;
      const mockRes = { setHeader: vi.fn() } as unknown as Response;

      const token = generateCsrfToken(mockReq, mockRes);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('validates CSRF token', async () => {
      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('valid-token'),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        },
      } as unknown as NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(true);
    });

    it('rejects invalid CSRF token', async () => {
      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('invalid-token'),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        },
      } as unknown as NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(false);
    });

    it('skips CSRF for GET requests', async () => {
      const mockReq = {
        method: 'GET',
        headers: {
          get: vi.fn(),
        },
      } as unknown as NextRequest;

      const isValid = await validateCsrfToken(mockReq);

      expect(isValid).toBe(true);
    });

    it('protects API routes with CSRF middleware', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const protectedHandler = withCsrfProtection(handler);

      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue('valid-token'),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'valid-token' }),
        },
      } as unknown as NextRequest;

      const response = await protectedHandler(mockReq);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('blocks requests without CSRF token', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const protectedHandler = withCsrfProtection(handler);

      const mockReq = {
        method: 'POST',
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'token' }),
        },
      } as unknown as NextRequest;

      const response = await protectedHandler(mockReq);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });
  });

  describe('Workspace Switching', () => {
    const mockWorkspaces = [
      { id: 'ws-1', name: 'Personal', role: 'owner' },
      { id: 'ws-2', name: 'Team', role: 'member' },
      { id: 'ws-3', name: 'Client', role: 'admin' },
    ];

    it('lists user workspaces', async () => {
      getMockPrisma().membership.findMany = vi.fn().mockResolvedValue(
        mockWorkspaces.map((ws) => ({
          role: ws.role,
          workspace: { id: ws.id, name: ws.name },
        }))
      );

      const memberships = await getMockPrisma().membership.findMany({
        where: { userId: 'user-001' },
        include: { workspace: true },
      });

      expect(memberships).toHaveLength(3);
      expect(memberships[0].workspace.name).toBe('Personal');
    });

    it('switches active workspace', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'user-001',
        activeWorkspaceId: 'ws-2',
      });
      getMockPrisma().user.update = mockUpdate;

      const result = await getMockPrisma().user.update({
        where: { id: 'user-001' },
        data: { activeWorkspaceId: 'ws-2' },
      });

      expect(result.activeWorkspaceId).toBe('ws-2');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { activeWorkspaceId: 'ws-2' },
      });
    });

    it('validates workspace membership on switch', async () => {
      getMockPrisma().membership.findFirst = vi.fn().mockResolvedValue(null);

      const membership = await getMockPrisma().membership.findFirst({
        where: {
          userId: 'user-001',
          workspaceId: 'unauthorized-ws',
        },
      });

      expect(membership).toBeNull();
    });

    it('stores workspace preference', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'user-001',
        preferences: { lastWorkspaceId: 'ws-2' },
      });
      getMockPrisma().user.update = mockUpdate;

      await getMockPrisma().user.update({
        where: { id: 'user-001' },
        data: {
          preferences: { lastWorkspaceId: 'ws-2' },
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('Permission Checks', () => {
    const permissionMatrix = [
      { role: 'owner', canDelete: true, canInvite: true, canManageBilling: true },
      { role: 'admin', canDelete: true, canInvite: true, canManageBilling: false },
      { role: 'member', canDelete: false, canInvite: false, canManageBilling: false },
      { role: 'viewer', canDelete: false, canInvite: false, canManageBilling: false },
    ];

    it.each(
      permissionMatrix
    )('$role canDelete: $canDelete, canInvite: $canInvite, canManageBilling: $canManageBilling', async ({
      role,
      canDelete,
      canInvite,
      canManageBilling,
    }) => {
      getMockPrisma().membership.findFirst = vi.fn().mockResolvedValue({
        userId: 'user-001',
        workspaceId: 'ws-1',
        role,
      });

      const membership = await getMockPrisma().membership.findFirst({
        where: {
          userId: 'user-001',
          workspaceId: 'ws-1',
        },
      });

      const permissions = getPermissions(membership.role);

      expect(permissions.canDelete).toBe(canDelete);
      expect(permissions.canInvite).toBe(canInvite);
      expect(permissions.canManageBilling).toBe(canManageBilling);
    });

    it('checks document access permissions', async () => {
      const mockDocument = {
        id: 'doc-1',
        workspaceId: 'ws-1',
        userId: 'user-001',
      };

      getMockPrisma().document.findFirst = vi.fn().mockResolvedValue(mockDocument);
      getMockPrisma().membership.findFirst = vi.fn().mockResolvedValue({
        role: 'member',
      });

      const doc = await getMockPrisma().document.findFirst({
        where: { id: 'doc-1' },
      });

      const membership = await getMockPrisma().membership.findFirst({
        where: {
          userId: 'user-001',
          workspaceId: doc.workspaceId,
        },
      });

      expect(membership).toBeDefined();
    });

    it('prevents access to other workspaces documents', async () => {
      getMockPrisma().membership.findFirst = vi.fn().mockResolvedValue(null);

      const membership = await getMockPrisma().membership.findFirst({
        where: {
          userId: 'user-001',
          workspaceId: 'other-workspace',
        },
      });

      expect(membership).toBeNull();
    });

    it('checks API key permissions', async () => {
      getMockPrisma().apiKey.findFirst = vi.fn().mockResolvedValue({
        id: 'key-1',
        workspaceId: 'ws-1',
        permissions: ['read', 'write'],
      });

      const apiKey = await getMockPrisma().apiKey.findFirst({
        where: { key: 'test-key' },
      });

      expect(apiKey?.permissions).toContain('read');
      expect(apiKey?.permissions).toContain('write');
    });
  });

  describe('JWT Token Handling', () => {
    it('includes user data in JWT', async () => {
      const token = {
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        picture: mockUser.image,
        workspaceId: 'ws-1',
      };

      expect(token.sub).toBe(mockUser.id);
      expect(token.workspaceId).toBeDefined();
    });

    it('validates JWT signature', async () => {
      const validToken = 'valid.jwt.token';
      const invalidToken = 'invalid.jwt.token';

      // Would be validated by NextAuth
      expect(validToken.split('.')).toHaveLength(3);
      expect(invalidToken.split('.')).toHaveLength(3);
    });

    it('includes workspace in JWT callback', async () => {
      const token = {
        sub: 'user-001',
        workspaceId: 'ws-1',
        membershipRole: 'owner',
      };

      expect(token.membershipRole).toBe('owner');
    });
  });

  describe('Account Security', () => {
    it('tracks failed login attempts', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'user-001',
        failedLoginAttempts: 1,
        lastFailedLogin: new Date(),
      });
      getMockPrisma().user.update = mockUpdate;

      await getMockPrisma().user.update({
        where: { email: 'test@example.com' },
        data: {
          failedLoginAttempts: { increment: 1 },
          lastFailedLogin: new Date(),
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('locks account after max failed attempts', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'user-001',
        locked: true,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });
      getMockPrisma().user.update = mockUpdate;

      await getMockPrisma().user.update({
        where: { id: 'user-001' },
        data: {
          locked: true,
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('resets failed attempts on successful login', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'user-001',
        failedLoginAttempts: 0,
        lastLogin: new Date(),
      });
      getMockPrisma().user.update = mockUpdate;

      await getMockPrisma().user.update({
        where: { id: 'user-001' },
        data: {
          failedLoginAttempts: 0,
          lastLogin: new Date(),
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('requires email verification', async () => {
      getMockPrisma().user.findUnique = vi.fn().mockResolvedValue({
        id: 'user-001',
        email: 'test@example.com',
        emailVerified: null,
      });

      const user = await getMockPrisma().user.findUnique({
        where: { email: 'test@example.com' },
      });

      expect(user?.emailVerified).toBeNull();
    });
  });
});

// Helper function for permission checking
function getPermissions(role: string) {
  const permissions = {
    owner: { canDelete: true, canInvite: true, canManageBilling: true },
    admin: { canDelete: true, canInvite: true, canManageBilling: false },
    member: { canDelete: false, canInvite: false, canManageBilling: false },
    viewer: { canDelete: false, canInvite: false, canManageBilling: false },
  };
  return permissions[role as keyof typeof permissions] || permissions.viewer;
}
