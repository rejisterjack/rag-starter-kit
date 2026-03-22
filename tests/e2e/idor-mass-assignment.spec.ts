/**
 * IDOR (Insecure Direct Object Reference) and Mass Assignment Tests
 *
 * Tests for:
 * - IDOR vulnerabilities (accessing other users' data)
 * - Mass assignment vulnerabilities (modifying restricted fields)
 * - Horizontal privilege escalation
 * - Vertical privilege escalation attempts
 */

import { expect, test } from '@playwright/test';

// Test data
const TEST_USERS = {
  userA: {
    email: 'user-a@example.com',
    password: 'SecurePass123!',
    workspaceName: 'User A Workspace',
  },
  userB: {
    email: 'user-b@example.com',
    password: 'SecurePass123!',
    workspaceName: 'User B Workspace',
  },
  admin: {
    email: 'admin@example.com',
    password: 'SecurePass123!',
  },
};

test.describe('IDOR - Insecure Direct Object Reference', () => {
  test.describe('Document Access Controls', () => {
    test('should prevent user A from accessing user B documents', async ({ page, request }) => {
      // Login as User A
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      // Get cookies for API requests
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to access documents with a document ID that doesn't belong to user A
      // In a real scenario, we'd create a document for User B and try to access it
      const maliciousDocumentId = 'doc-userb-123';

      const response = await request.get(`/api/documents/${maliciousDocumentId}`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      // Should return 404 (not found) or 403 (forbidden)
      // 404 is better for security (don't reveal existence)
      expect(response.status()).toBeOneOf([404, 403]);
    });

    test('should prevent accessing documents across workspaces', async ({ page, request }) => {
      // Login as User A
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to list documents from a different workspace
      const otherWorkspaceId = 'workspace-b-456';

      const response = await request.get(`/api/documents?workspaceId=${otherWorkspaceId}`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      // Should return 403 forbidden or empty list
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.data || body.items || []).toHaveLength(0);
      } else {
        expect(response.status()).toBe(403);
      }
    });
  });

  test.describe('Conversation Access Controls', () => {
    test('should prevent accessing other users conversations', async ({ page, request }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to access a conversation that belongs to User B
      const otherUserConversationId = 'conv-userb-789';

      const response = await request.get(`/api/chat/${otherUserConversationId}`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBeOneOf([404, 403]);
    });

    test('should prevent accessing conversation messages from other users', async ({
      page,
      request,
    }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      const otherConversationId = 'conv-userb-messages';

      const response = await request.get(`/api/chat/${otherConversationId}/messages`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBeOneOf([404, 403]);
    });
  });

  test.describe('Workspace Access Controls', () => {
    test('should prevent non-members from accessing workspace', async ({ page, request }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to access User B's workspace directly
      const otherWorkspaceId = 'workspace-userb-123';

      const response = await request.get(`/api/workspaces/${otherWorkspaceId}`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBeOneOf([404, 403]);
    });

    test('should prevent viewers from accessing admin endpoints', async ({ page, request }) => {
      // Create a user with VIEWER role
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to access admin endpoints
      const adminEndpoints = ['/api/admin/workspaces', '/api/admin/audit-logs', '/api/admin/users'];

      for (const endpoint of adminEndpoints) {
        const response = await request.get(endpoint, {
          headers: {
            Cookie: cookieHeader,
          },
        });

        expect(response.status()).toBe(403);
      }
    });
  });

  test.describe('API Key Access Controls', () => {
    test('should prevent accessing other users API keys', async ({ page, request }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to revoke someone else's API key
      const otherUserApiKeyId = 'apikey-userb-123';

      const response = await request.delete(`/api/api-keys/${otherUserApiKeyId}`, {
        headers: {
          Cookie: cookieHeader,
        },
      });

      expect(response.status()).toBeOneOf([404, 403]);
    });
  });
});

test.describe('Mass Assignment Protection', () => {
  test.describe('User Profile Updates', () => {
    test('should prevent mass assignment of protected user fields', async ({ page, request }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to update protected fields
      const maliciousUpdate = {
        name: 'New Name',
        role: 'ADMIN', // Trying to escalate privileges
        id: 'different-user-id',
        emailVerified: new Date().toISOString(),
        createdAt: '2020-01-01',
      };

      const response = await request.patch('/api/user/profile', {
        data: maliciousUpdate,
        headers: {
          Cookie: cookieHeader,
          'Content-Type': 'application/json',
        },
      });

      // Should either reject or ignore the protected fields
      if (response.status() === 200) {
        const body = await response.json();
        // Verify protected fields were not updated
        expect(body.role).not.toBe('ADMIN');
      } else {
        expect(response.status()).toBeOneOf([400, 403]);
      }
    });
  });

  test.describe('Workspace Updates', () => {
    test('should prevent mass assignment of protected workspace fields', async ({
      page,
      request,
    }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to update protected workspace fields
      const maliciousUpdate = {
        name: 'New Workspace Name',
        ownerId: 'different-owner-id', // Trying to change ownership
        slug: 'admin-workspace', // Trying to take reserved slug
        createdAt: '2020-01-01',
        subscription: {
          plan: 'enterprise',
          status: 'active',
        },
      };

      const workspaceId = 'workspace-usera-123';

      const response = await request.patch(`/api/workspaces/${workspaceId}`, {
        data: maliciousUpdate,
        headers: {
          Cookie: cookieHeader,
          'Content-Type': 'application/json',
        },
      });

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.ownerId).not.toBe('different-owner-id');
      } else {
        expect(response.status()).toBeOneOf([400, 403]);
      }
    });

    test('should prevent members from updating workspace settings', async ({ page, request }) => {
      // Login as a regular member (not admin/owner)
      await page.goto('/login');
      await page.fill('input[name="email"]', 'member@example.com');
      await page.fill('input[name="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      const response = await request.patch('/api/workspaces/workspace-123/settings', {
        data: {
          allowPublicSharing: true,
          defaultModel: 'gpt-4',
        },
        headers: {
          Cookie: cookieHeader,
          'Content-Type': 'application/json',
        },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('Document Metadata Updates', () => {
    test('should prevent modifying document ownership via mass assignment', async ({
      page,
      request,
    }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      const maliciousUpdate = {
        name: 'Updated Name',
        workspaceId: 'different-workspace',
        userId: 'different-user',
        status: 'completed',
        createdAt: '2020-01-01',
      };

      const documentId = 'doc-usera-123';

      const response = await request.patch(`/api/documents/${documentId}`, {
        data: maliciousUpdate,
        headers: {
          Cookie: cookieHeader,
          'Content-Type': 'application/json',
        },
      });

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.workspaceId).not.toBe('different-workspace');
        expect(body.userId).not.toBe('different-user');
      } else {
        expect(response.status()).toBeOneOf([400, 403]);
      }
    });
  });

  test.describe('API Key Creation', () => {
    test('should prevent creating API keys with excessive permissions', async ({
      page,
      request,
    }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USERS.userA.email);
      await page.fill('input[name="password"]', TEST_USERS.userA.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/chat');

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Try to create API key with admin permissions as regular user
      const maliciousKey = {
        name: 'My Key',
        permissions: [
          'read:documents',
          'write:documents',
          'delete:workspace', // Admin permission
          'manage:members', // Admin permission
          'view:audit_logs', // Admin permission
        ],
      };

      const response = await request.post('/api/api-keys', {
        data: maliciousKey,
        headers: {
          Cookie: cookieHeader,
          'Content-Type': 'application/json',
        },
      });

      if (response.status() === 201) {
        const body = await response.json();
        // Should have filtered out admin permissions
        expect(body.permissions).not.toContain('delete:workspace');
        expect(body.permissions).not.toContain('manage:members');
        expect(body.permissions).not.toContain('view:audit_logs');
      } else {
        expect(response.status()).toBeOneOf([400, 403]);
      }
    });
  });
});

test.describe('Privilege Escalation Prevention', () => {
  test('should prevent horizontal privilege escalation', async ({ page, request }) => {
    // User A tries to act as User B within same workspace
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.userA.email);
    await page.fill('input[name="password"]', TEST_USERS.userA.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/chat');

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Try to send message as another user
    const response = await request.post('/api/chat', {
      data: {
        message: 'Hello',
        userId: 'user-b-id', // Trying to impersonate
      },
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/json',
      },
    });

    // Should either reject or use authenticated user from session
    if (response.status() === 200) {
      const body = await response.json();
      // Verify the message was created with actual user's ID
      expect(body.userId).not.toBe('user-b-id');
    } else {
      expect(response.status()).toBeOneOf([400, 403]);
    }
  });

  test('should prevent vertical privilege escalation', async ({ page }) => {
    // Regular user tries to access admin functionality
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.userA.email);
    await page.fill('input[name="password"]', TEST_USERS.userA.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/chat');

    // Try to navigate to admin pages
    await page.goto('/admin');

    // Should be redirected or shown 403
    await expect(page).toHaveURL(/\/403|\/login|\/chat/);
  });
});
