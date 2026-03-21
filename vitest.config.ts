import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Enable global test APIs (describe, it, expect)
    globals: true,
    
    // Setup files to run before tests
    setupFiles: ['./tests/setup.ts'],
    
    // Include and exclude patterns
    include: [
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'tests/e2e/**/*', // E2E tests run separately with Playwright
      'tests/performance/**/*', // Performance tests run separately
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/lib/db/', // Generated Prisma client
        'src/lib/inngest/', // Background job functions
        '.next/',
        '**/mock*.ts',
        '**/fixtures/**',
      ],
      include: [
        'src/**/*.{js,ts,jsx,tsx}',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      // Enable reporting even if thresholds aren't met (for CI)
      reportOnFailure: true,
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Retry flaky tests in CI
    retry: process.env.CI ? 2 : 0,
    
    // Workers for parallel execution
    maxWorkers: process.env.CI ? 2 : undefined,
    
    // Isolate each test file
    isolate: true,
    
    // Reporter configuration
    reporters: process.env.CI 
      ? ['default', 'junit', 'json'] 
      : ['default', 'verbose'],
    outputFile: {
      junit: './test-results/junit.xml',
      json: './test-results/results.json',
    },
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-secret-32chars-long!!!!',
      ENCRYPTION_MASTER_KEY: 'test-master-key-32chars-long!!',
    },
    
    // Snapshot format
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    
    // Update snapshots in CI only when explicitly requested
    update: process.env.CI ? false : undefined,
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  
  // Build configuration (for tests that need it)
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@testing-library/react',
      '@testing-library/jest-dom',
    ],
  },
  
  // Server configuration for tests
  server: {
    port: 3001,
    strictPort: false,
  },
});
