/**
 * Test Setup Utilities
 *
 * Shared setup helpers for integration and unit tests.
 */

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Global test setup
beforeAll(() => {
  // Add any global test setup here
  // e.g., mocking environment variables
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.NEXTAUTH_SECRET = 'test-secret';
});

// Global test teardown
afterAll(() => {
  // Add any global cleanup here
});

/**
 * Create a mock request object for API testing
 */
export function createMockRequest(
  options: { method?: string; url?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  const { method = 'GET', url = 'http://localhost:3000/api/test', body, headers = {} } = options;

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock file for upload testing
 */
export function createMockFile(
  options: { name?: string; type?: string; size?: number; content?: string } = {}
): File {
  const { name = 'test.txt', type = 'text/plain', content = 'test content' } = options;
  return new File([content], name, { type });
}
