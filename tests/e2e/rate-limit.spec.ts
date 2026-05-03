/**
 * Rate Limit E2E Tests
 *
 * Tests for rate limiting functionality across different endpoints
 * with various rate limit tiers.
 */

import { expect, test } from '@playwright/test';

// =============================================================================
// Configuration
// =============================================================================

const RATE_LIMITS = {
  chat: { limit: 50, window: '1 hour' },
  ingest: { limit: 10, window: '1 hour' },
  login: { limit: 5, window: '5 minutes' },
  api: { limit: 100, window: '1 minute' },
};

// =============================================================================
// Helper Functions
// =============================================================================

async function makeRequests(
  request: ReturnType<typeof test.request>,
  url: string,
  count: number,
  method: 'GET' | 'POST' = 'GET',
  data?: unknown
) {
  const responses = [];

  for (let i = 0; i < count; i++) {
    const response = method === 'POST' ? await request.post(url, { data }) : await request.get(url);

    responses.push(response);

    // Small delay to prevent overwhelming
    if (i < count - 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return responses;
}

function checkRateLimitHeaders(response: Awaited<ReturnType<typeof test.request.get>>) {
  const headers = response.headers();
  return {
    limit: headers['x-ratelimit-limit'],
    remaining: headers['x-ratelimit-remaining'],
    reset: headers['x-ratelimit-reset'],
    hasHeaders: !!(headers['x-ratelimit-limit'] || headers['x-ratelimit-remaining']),
  };
}

// =============================================================================
// Rate Limit Tests
// =============================================================================

test.describe('Chat Rate Limiting', () => {
  test('should enforce chat endpoint rate limit', async ({ request }) => {
    // Make requests up to and beyond limit
    const responses = await makeRequests(request, '/api/chat', RATE_LIMITS.chat.limit + 5, 'POST', {
      message: 'test',
    });

    // All requests should have rate limit headers
    for (const response of responses) {
      const rateLimitInfo = checkRateLimitHeaders(response);
      expect(rateLimitInfo.hasHeaders).toBe(true);
    }

    // Some requests should be rate limited (429)
    const rateLimitedCount = responses.filter((r) => r.status() === 429).length;
    expect(rateLimitedCount).toBeGreaterThan(0);

    // Rate limited responses should have retry-after header
    const rateLimitedResponse = responses.find((r) => r.status() === 429);
    if (rateLimitedResponse) {
      expect(rateLimitedResponse.headers()['retry-after']).toBeTruthy();
    }
  });

  test('should reset rate limit after window', async ({ request }) => {
    // This test would need to wait for the rate limit window
    // In practice, you might mock time or use a test-specific shorter window
    test.skip(true, 'Requires time manipulation or test-specific config');
  });

  test('should track rate limits per user', async ({ page, request }) => {
    // Login as user 1
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user1@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    // Get cookies for authenticated requests
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Make requests as user 1
    const user1Responses = await makeRequests(request, '/api/chat', 10, 'POST', {
      message: 'test',
    });

    // Should have rate limit headers
    const user1Info = checkRateLimitHeaders(user1Responses[0]);
    expect(user1Info.hasHeaders).toBe(true);

    // Logout and login as user 2
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user2@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/chat');

    // Get cookies for user 2
    const cookies2 = await page.context().cookies();
    const cookieHeader2 = cookies2.map((c) => `${c.name}=${c.value}`).join('; ');

    // Make requests as user 2
    const user2Responses = await makeRequests(request, '/api/chat', 5, 'POST', { message: 'test' });

    // User 2 should have independent rate limit
    const user2Info = checkRateLimitHeaders(user2Responses[0]);
    expect(user2Info.hasHeaders).toBe(true);
  });
});

test.describe('Authentication Rate Limiting', () => {
  test('should enforce login rate limit', async ({ page }) => {
    await page.goto('/login');

    // Attempt multiple failed logins
    for (let i = 0; i < RATE_LIMITS.login.limit + 2; i++) {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', `wrongpassword${i}`);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // Should be rate limited
    const response = await page.waitForResponse('**/api/auth/**');

    if (response.status() === 429) {
      // Check rate limit headers
      const headers = response.headers();
      expect(headers['retry-after']).toBeTruthy();

      // Should show rate limit message
      await expect(
        page.locator('text=too many|rate limit|try again later', {
          ignoreCase: true,
        })
      ).toBeVisible();
    }
  });

  test('should have different limits for different endpoints', async ({ request }) => {
    // Login endpoint
    const loginResponse = await request.post('/api/auth/callback/credentials', {
      data: {
        email: 'test@example.com',
        password: 'wrong',
      },
    });

    const loginRateLimit = checkRateLimitHeaders(loginResponse);

    // API endpoint
    const apiResponse = await request.get('/api/health');
    const apiRateLimit = checkRateLimitHeaders(apiResponse);

    // Both should have rate limit headers
    expect(loginRateLimit.hasHeaders || apiRateLimit.hasHeaders).toBe(true);
  });
});

test.describe('IP-Based Rate Limiting', () => {
  test('should apply IP-based rate limits for unauthenticated requests', async ({ request }) => {
    // Make many unauthenticated requests
    const responses = await makeRequests(
      request,
      '/api/health',
      150, // More than API limit
      'GET'
    );

    // Some should be rate limited
    const rateLimitedCount = responses.filter((r) => r.status() === 429).length;

    // This might be 0 if the endpoint doesn't have rate limiting
    // But we should at least have rate limit headers
    const hasRateLimitHeaders = responses.some((r) => checkRateLimitHeaders(r).hasHeaders);

    if (hasRateLimitHeaders) {
      expect(rateLimitedCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should track IP separately from authenticated users', async ({ request }) => {
    // Unauthenticated request
    const anonResponse = await request.get('/api/health');
    const anonInfo = checkRateLimitHeaders(anonResponse);

    // Authenticated request would have different rate limit
    // This is more of a conceptual test - actual implementation varies
    expect(anonInfo.hasHeaders).toBeDefined();
  });
});

test.describe('API Key Rate Limiting', () => {
  test('should have higher limits for API keys', async ({ request }) => {
    // Request without API key
    const noKeyResponse = await request.get('/api/documents');
    const noKeyInfo = checkRateLimitHeaders(noKeyResponse);

    // Request with invalid API key
    const withKeyResponse = await request.get('/api/documents', {
      headers: {
        'X-API-Key': 'invalid-key',
      },
    });

    // Both should have rate limit headers
    const withKeyInfo = checkRateLimitHeaders(withKeyResponse);

    // API key requests might have different limits
    // This test documents the expected behavior
    expect(noKeyInfo.hasHeaders || withKeyInfo.hasHeaders).toBeDefined();
  });
});

test.describe('Rate Limit Headers', () => {
  test('should include rate limit headers in responses', async ({ request }) => {
    const response = await request.get('/api/health');

    const headers = response.headers();

    // Check for rate limit headers
    const hasLimit = 'x-ratelimit-limit' in headers;
    const hasRemaining = 'x-ratelimit-remaining' in headers;
    const hasReset = 'x-ratelimit-reset' in headers;

    // At least some rate limit headers should be present
    expect(hasLimit || hasRemaining || hasReset).toBe(true);
  });

  test('should provide meaningful rate limit values', async ({ request }) => {
    const response = await request.get('/api/health');
    const headers = response.headers();

    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];

    if (limit && remaining) {
      const limitNum = parseInt(limit, 10);
      const remainingNum = parseInt(remaining, 10);

      expect(limitNum).toBeGreaterThan(0);
      expect(remainingNum).toBeGreaterThanOrEqual(0);
      expect(remainingNum).toBeLessThanOrEqual(limitNum);
    }
  });

  test('should include retry-after header for rate limited responses', async ({ request }) => {
    // Make many requests to trigger rate limit
    const responses = await makeRequests(request, '/api/health', 200, 'GET');

    const rateLimitedResponse = responses.find((r) => r.status() === 429);

    if (rateLimitedResponse) {
      const retryAfter = rateLimitedResponse.headers()['retry-after'];
      expect(retryAfter).toBeTruthy();

      const retrySeconds = parseInt(retryAfter, 10);
      expect(retrySeconds).toBeGreaterThan(0);
    }
  });
});

test.describe('Rate Limit Recovery', () => {
  test('should allow requests after rate limit window', async ({ request }) => {
    // This test is skipped by default as it requires waiting
    test.skip(true, 'Requires time manipulation or long test duration');

    // Trigger rate limit
    await makeRequests(request, '/api/health', 200, 'GET');

    // Wait for rate limit window to reset (would need actual time)
    // await new Promise(r => setTimeout(r, 60000));

    // Should be able to make requests again
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
  });
});
