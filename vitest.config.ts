import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/lib/db/', // Generated Prisma client
      ],
      include: [
        'src/**/*.{js,ts,jsx,tsx}',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Enable type checking
    typecheck: {
      enabled: true,
      checker: 'tsc',
      include: ['src/**/*.ts', 'tests/**/*.ts'],
    },
    
    // Mock CSS imports
    css: {
      include: [/\.css$/],
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    
    // Alias resolution
    alias: {
      '@/': path.resolve(__dirname, './src/'),
      '@tests/': path.resolve(__dirname, './tests/'),
    },
    
    // Retry flaky tests in CI
    retry: process.env.CI ? 2 : 0,
    
    // Workers for parallel execution
    workers: process.env.CI ? 2 : undefined,
    
    // Isolate each test file
    isolate: true,
    
    // Reporter configuration
    reporter: process.env.CI 
      ? ['default', 'junit'] 
      : ['default', 'verbose'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
    },
    
    // Snapshot format
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    
    // Update snapshots in CI
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
  
  // CSS configuration
  css: {
    postcss: {
      plugins: [],
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
  
  // Esbuild configuration
  esbuild: {
    loader: 'tsx',
    include: [
      'src/**/*.tsx',
      'tests/**/*.tsx',
    ],
    exclude: [],
  },
  
  // Server configuration for tests
  server: {
    port: 3001,
    strictPort: false,
  },
});
