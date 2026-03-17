/**
 * Test Setup File
 * 
 * This file runs before all tests to set up the test environment.
 * Configured in vitest.config.ts as setupFiles.
 */

import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetPrismaMocks } from '@/tests/utils/mocks/prisma';
import { resetOpenAIMocks } from '@/tests/utils/mocks/openai';

// ============================================================================
// Global Mocks
// ============================================================================

// Mock Next.js router
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

// Mock Next.js server components
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}));

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
    update: vi.fn(),
  })),
  getSession: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {},
}));

// Mock environment variables
vi.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    OPENAI_API_KEY: 'test-api-key',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NEXTAUTH_SECRET: 'test-secret',
    NEXTAUTH_URL: 'http://localhost:3000',
  },
}));

// ============================================================================
// Browser APIs Mocks
// ============================================================================

// Mock IntersectionObserver
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

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock fetch
global.fetch = vi.fn();

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});

// ============================================================================
// Global Test Hooks
// ============================================================================

beforeAll(() => {
  // Setup that runs once before all tests
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  // Cleanup that runs once after all tests
  console.log('✅ Test suite completed');
});

beforeEach(() => {
  // Reset all mocks before each test
  resetPrismaMocks();
  resetOpenAIMocks();
  vi.clearAllMocks();
  
  // Reset fetch mock
  vi.mocked(global.fetch).mockReset();
});

afterEach(() => {
  // Clean up DOM after each test
  cleanup();
});

// ============================================================================
// Custom Matchers (if any additional to jest-dom)
// ============================================================================

// Example custom matcher
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// ============================================================================
// Type Augmentations
// ============================================================================

declare global {
  namespace Vi {
    interface Assertion {
      toBeWithinRange(floor: number, ceiling: number): void;
    }
    interface AsymmetricMatchersContaining {
      toBeWithinRange(floor: number, ceiling: number): void;
    }
  }
}

// Export empty object to make this a module
export {};
