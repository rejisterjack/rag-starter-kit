/**
 * Test Setup Helpers
 * 
 * Shared utilities for setting up and tearing down tests.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { mockPrisma, resetPrismaMocks } from '../mocks/prisma';
import { resetOpenAIMocks } from '../mocks/openai';

/**
 * Global test setup - runs before each test
 */
export const setupTestEnvironment = (): void => {
  // Reset all mocks
  beforeEach(() => {
    resetPrismaMocks();
    resetOpenAIMocks();
    cleanup();
  });

  // Clean up after each test
  afterEach(() => {
    cleanup();
  });
};

/**
 * Mock Next.js router
 */
export const mockNextRouter = (): void => {
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      pathname: '/',
      query: {},
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  }));
};

/**
 * Mock Next.js server actions
 */
export const mockServerActions = (): void => {
  vi.mock('next/headers', () => ({
    cookies: () => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }),
    headers: () => new Headers(),
  }));
};

/**
 * Mock NextAuth.js session
 */
export const mockNextAuthSession = (session: MockSession | null = defaultMockSession): void => {
  vi.mock('next-auth/react', () => ({
    useSession: () => ({
      data: session,
      status: session ? 'authenticated' : 'unauthenticated',
      update: vi.fn(),
    }),
    getSession: vi.fn().mockResolvedValue(session),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }));

  vi.mock('@/lib/auth', () => ({
    auth: vi.fn().mockResolvedValue(session),
  }));
};

/**
 * Default mock session
 */
export const defaultMockSession: MockSession = {
  user: {
    id: 'user-001',
    email: 'test@example.com',
    name: 'Test User',
    image: 'https://example.com/avatar.png',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export interface MockSession {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
  };
  expires: string;
}

/**
 * Mock window.matchMedia for responsive component tests
 */
export const mockMatchMedia = (matches: boolean = true): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

/**
 * Mock IntersectionObserver for lazy loading tests
 */
export const mockIntersectionObserver = (): void => {
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn().mockReturnValue([]);
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  });
}

/**
 * Mock ResizeObserver for responsive tests
 */
export const mockResizeObserver = (): void => {
  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: MockResizeObserver,
  });
};

/**
 * Mock fetch for API tests
 */
export const mockFetch = (response: unknown, status: number = 200): void => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response)),
    headers: new Headers(),
  });
};

/**
 * Create a mock fetch that returns different responses for different URLs
 */
export const createMockFetch = (
  responses: Record<string, { data: unknown; status?: number }>
): void => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const response = responses[url];
    if (!response) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: 'Not found' }),
      });
    }

    return Promise.resolve({
      ok: (response.status ?? 200) >= 200 && (response.status ?? 200) < 300,
      status: response.status ?? 200,
      json: vi.fn().mockResolvedValue(response.data),
      text: vi.fn().mockResolvedValue(JSON.stringify(response.data)),
      headers: new Headers(),
    });
  });
};

/**
 * Mock clipboard API
 */
export const mockClipboard = (): void => {
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
  });
};

/**
 * Suppress console errors during tests (use sparingly)
 */
export const suppressConsoleErrors = (): (() => void) => {
  const originalError = console.error;
  console.error = vi.fn();
  return () => {
    console.error = originalError;
  };
};

/**
 * Wait for a specific amount of time
 */
export const wait = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for element to be removed from DOM
 */
export const waitForElementToBeRemoved = async (
  callback: () => HTMLElement | null,
  timeout: number = 1000
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (!callback()) return;
    await wait(10);
  }
  throw new Error('Element was not removed within timeout');
};

/**
 * Create a deferred promise for async testing
 */
export const createDeferredPromise = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} => {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
};

/**
 * Setup all common mocks
 */
export const setupCommonMocks = (): void => {
  mockMatchMedia();
  mockIntersectionObserver();
  mockResizeObserver();
  mockClipboard();
};

/**
 * Get mocked Prisma client for assertions
 */
export const getMockPrisma = () => mockPrisma;
