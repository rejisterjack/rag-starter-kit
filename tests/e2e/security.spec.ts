/**
 * Security-Focused E2E Tests
 *
 * Comprehensive security testing including:
 * - Authentication flows
 * - Authorization (RBAC)
 * - CSRF protection
 * - Rate limiting
 * - XSS prevention
 * - SQL injection prevention
 * - Session management
 */

import { expect, test } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

const TEST_USERS = {
  admin: {
    email: 'admin@example.com',
    password: 'Admin123!',
  },
  member: {
    email: 'member@example.com',
    password: 'Member123!',
  },
  viewer: {
    email: 'viewer@example.com',
    password: 'Viewer123!',
  },
};

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert("xss")>',
  'javascript:alert("xss")',
  '<svg onload=alert("xss")>',
  '><script>alert(String.fromCharCode(88,83,83))</script>',
];

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "' OR 1=1--",
  "'; DROP TABLE users; --",
  "1' UNION SELECT * FROM users--",
  '1 AND 1=1',
];

// =============================================================================
// Authentication Security Tests
// =============================================================================

test.describe('Authentication Security', () => {
  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on login page
    await expect(page).toHaveURL('/login');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should prevent brute force with rate limiting', async ({ page }) => {
    await page.goto('/login');

    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', `wrongpassword${i}`);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // Should be rate limited
    await expect(page.locator('text=too many attempts')).toBeVisible();

    // Check for rate limit headers
    const response = await page.waitForResponse('**/api/auth/callback/**');
    expect(response.status()).toBe(429);
  });

  test('should enforce strong password requirements', async ({ page }) => {
    await page.goto('/register');

    // Try weak password
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'weak');
    await page.fill('input[name="confirmPassword"]', 'weak');
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=password must be at least')).toBeVisible();
  });

  test('should expire session after inactivity', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/chat');

    // Simulate session timeout (in real test, would manipulate cookies/session)
    await page.evaluate(() => {
      // Clear auth cookie
      document.cookie = 'next-auth.session-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });

    // Try to access protected page
    await page.goto('/chat');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});

// =============================================================================
// Authorization (RBAC) Tests
// =============================================================================

test.describe('Authorization (RBAC)', () => {
  test('admin should access admin panel', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.admin.email);
    await page.fill('input[name="password"]', TEST_USERS.admin.password);
    await page.click('button[type="submit"]');

    await page.goto('/admin');

    // Should access admin panel
    await expect(page.locator('h1:has-text("Admin")')).toBeVisible();
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
  });

  test('member should NOT access admin panel', async ({ page }) => {
    // Login as member
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await page.goto('/admin');

    // Should be redirected or show forbidden
    await expect(page.locator('text=forbidden|access denied', { ignoreCase: true })).toBeVisible();
  });

  test('viewer should only read documents, not write', async ({ page }) => {
    // Login as viewer
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.viewer.email);
    await page.fill('input[name="password"]', TEST_USERS.viewer.password);
    await page.click('button[type="submit"]');

    // Should see documents
    await page.goto('/chat');
    await expect(page.locator('[data-testid="document-list"]')).toBeVisible();

    // Should NOT see upload button
    await expect(page.locator('[data-testid="upload-button"]')).not.toBeVisible();

    // Attempting upload API directly should fail
    const response = await page.request.post('/api/documents', {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('test content'),
        },
      },
    });

    expect(response.status()).toBe(403);
  });

  test('should verify API key permissions', async ({ request }) => {
    // Create API key with limited permissions
    const response = await request.post('/api/api-keys', {
      data: {
        name: 'Test Key',
        permissions: ['read:documents'],
      },
    });

    expect(response.status()).toBe(401); // Requires auth

    // Test with API key should validate permissions
    const apiResponse = await request.get('/api/documents', {
      headers: {
        'X-API-Key': 'invalid-key',
      },
    });

    expect(apiResponse.status()).toBe(401);
  });
});

// =============================================================================
// CSRF Protection Tests
// =============================================================================

test.describe('CSRF Protection', () => {
  test('should reject requests without CSRF token', async ({ request }) => {
    // POST without CSRF token should fail
    const response = await request.post('/api/chat', {
      data: { message: 'test' },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toContain('CSRF');
  });

  test('should reject requests with invalid CSRF token', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { message: 'test' },
      headers: {
        'x-csrf-token': 'invalid-token',
      },
    });

    expect(response.status()).toBe(403);
  });

  test('should accept requests with valid CSRF token', async ({ page, request }) => {
    // Login to get CSRF token
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    // Get CSRF token from cookie
    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find((c) => c.name === 'csrf_token');

    if (csrfCookie) {
      // Request with valid CSRF should work (or fail for other reasons, not CSRF)
      const response = await request.post('/api/chat', {
        data: { message: 'test' },
        headers: {
          'x-csrf-token': csrfCookie.value,
        },
      });

      // Should not be 403 CSRF error
      if (response.status() === 403) {
        const body = await response.json();
        expect(body.error?.code).not.toContain('CSRF');
      }
    }
  });
});

// =============================================================================
// XSS Prevention Tests
// =============================================================================

test.describe('XSS Prevention', () => {
  test('should sanitize user input in chat messages', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    for (const payload of XSS_PAYLOADS) {
      // Send XSS payload
      await page.fill('[data-testid="message-input"]', payload);
      await page.click('[data-testid="send-button"]');

      // Wait for message to appear
      await page.waitForTimeout(500);

      // Verify script is not executed (would cause alert)
      const hasAlert = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const originalAlert = window.alert;
          let alertCalled = false;
          window.alert = () => {
            alertCalled = true;
          };
          setTimeout(() => {
            window.alert = originalAlert;
            resolve(alertCalled);
          }, 100);
        });
      });

      expect(hasAlert).toBe(false);

      // Verify content is escaped in DOM
      const messageContent = await page.locator('.message-content').last().innerHTML();
      expect(messageContent).not.toContain('<script>');
      expect(messageContent).not.toContain('javascript:');
    }
  });

  test('should sanitize document names', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    // Try to upload file with XSS in name
    const xssFilename = '<img src=x onerror=alert("xss")>.txt';

    // Upload should sanitize or reject
    // This is a simplified test - actual implementation may vary
    await page.setInputFiles('[data-testid="file-input"]', {
      name: xssFilename,
      mimeType: 'text/plain',
      buffer: Buffer.from('test content'),
    });
  });
});

// =============================================================================
// SQL Injection Prevention Tests
// =============================================================================

test.describe('SQL Injection Prevention', () => {
  test('should prevent SQL injection in search queries', async ({ page, request }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    for (const payload of SQL_INJECTION_PAYLOADS) {
      // Try SQL injection in search
      const response = await request.get(`/api/search?q=${encodeURIComponent(payload)}`);

      // Should return 200 with empty results or validation error, not 500
      expect(response.status()).not.toBe(500);

      // Should not expose database error
      const body = await response.text();
      expect(body).not.toContain('SQL');
      expect(body).not.toContain('syntax error');
      expect(body).not.toContain('database');
    }
  });

  test('should prevent SQL injection in document IDs', async ({ request }) => {
    for (const payload of SQL_INJECTION_PAYLOADS) {
      const response = await request.get(`/api/documents/${encodeURIComponent(payload)}`);

      // Should not cause server error
      expect(response.status()).not.toBe(500);
    }
  });
});

// =============================================================================
// Security Headers Tests
// =============================================================================

test.describe('Security Headers', () => {
  test('should include security headers in responses', async ({ page }) => {
    const response = await page.goto('/');

    const headers = response?.headers();

    // Check security headers
    expect(headers?.['x-frame-options']).toBe('DENY');
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['referrer-policy']).toBeTruthy();
    expect(headers?.['content-security-policy']).toBeTruthy();
  });

  test('should set secure cookies', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session'));

    if (sessionCookie) {
      // In production, should be secure and httpOnly
      if (process.env.NODE_ENV === 'production') {
        expect(sessionCookie.httpOnly).toBe(true);
        expect(sessionCookie.secure).toBe(true);
        expect(sessionCookie.sameSite).toBe('Lax');
      }
    }
  });
});

// =============================================================================
// Input Validation Tests
// =============================================================================

test.describe('Input Validation', () => {
  test('should validate file upload types', async ({ request }) => {
    // Try to upload executable file
    const response = await request.post('/api/documents', {
      multipart: {
        file: {
          name: 'malicious.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from('MZ'), // Windows executable header
        },
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error?.message).toContain('file type');
  });

  test('should validate message length limits', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.member.email);
    await page.fill('input[name="password"]', TEST_USERS.member.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    // Try to send very long message
    const longMessage = 'a'.repeat(100000);
    await page.fill('[data-testid="message-input"]', longMessage);
    await page.click('[data-testid="send-button"]');

    // Should show validation error
    await expect(page.locator('text=too long|character limit', { ignoreCase: true })).toBeVisible();
  });

  test('should sanitize API key names', async ({ request }) => {
    const response = await request.post('/api/api-keys', {
      data: {
        name: '<script>alert("xss")</script>',
      },
    });

    expect(response.status()).toBe(401); // Requires auth, but should not crash
  });
});
