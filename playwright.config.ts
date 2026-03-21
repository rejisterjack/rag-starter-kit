import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Run files matching these patterns
  testMatch: /.*\.spec\.ts/,
  
  // Ignore files matching these patterns
  testIgnore: /.*\.skip\.spec\.ts/,
  
  // Fully parallel mode - run all tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    // HTML reporter for local debugging
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    // JSON reporter for CI
    ['json', { outputFile: 'playwright-report/results.json' }],
    // JUnit reporter for CI integration
    ['junit', { outputFile: 'playwright-report/results.xml' }],
    // List reporter for console output
    ['list'],
    // Visual regression reporter
    ['blob', { outputFile: 'playwright-report/blob.zip' }],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'on-first-retry',
    
    // Capture network activity
    // network: 'on-first-retry',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // Action timeout
    actionTimeout: 15000,
    
    // Navigation timeout
    navigationTimeout: 15000,
    
    // Ignore HTTPS errors (for local development with self-signed certs)
    ignoreHTTPSErrors: true,
    
    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Permissions
    permissions: ['clipboard-read', 'clipboard-write'],
    
    // Color scheme
    colorScheme: 'light',
  },
  
  // Configure projects for major browsers
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testMatch: /global\.teardown\.ts/,
    },
    
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    
    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },
    
    // Tablet
    {
      name: 'Tablet Chrome',
      use: { ...devices['Galaxy Tab S4'] },
      dependencies: ['setup'],
    },
    
    // Headless mode for CI
    {
      name: 'chromium-headless',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--headless=new'],
        },
      },
      dependencies: ['setup'],
    },

    // Visual regression tests
    {
      name: 'visual-regression',
      testMatch: /.*\.visual\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      dependencies: ['setup'],
    },
  ],
  
  // Run local dev server before starting the tests
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes
      env: {
        NODE_ENV: 'test',
      },
    },
    // Optional: Start Inngest dev server if needed
    {
      command: 'pnpm inngest:dev',
      url: 'http://localhost:8288',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    },
  ],
  
  // Global setup and teardown
  // globalSetup: './tests/e2e/global-setup.ts',
  // globalTeardown: './tests/e2e/global-teardown.ts',
  
  // Output directory for test artifacts
  outputDir: './playwright-report/test-results',
  
  // Snapshot directory for visual regression
  snapshotDir: './tests/e2e/snapshots',
  
  // Update snapshots on CI only when explicitly requested
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  
  // Expect timeout
  expect: {
    timeout: 5000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.1,
    },
  },
  
  // Timeout for each test
  timeout: 30000,
  
  // Grace period for workers to shutdown
  globalTimeout: 60 * 60 * 1000, // 1 hour
  
  // Reporter configuration for CI
  ...(process.env.CI && {
    reporter: [
      ['github'],
      ['json', { outputFile: 'playwright-report/results.json' }],
      ['junit', { outputFile: 'playwright-report/results.xml' }],
      ['blob', { outputFile: 'playwright-report/blob.zip' }],
    ],
  }),
});
