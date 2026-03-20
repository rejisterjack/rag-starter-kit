/**
 * Global Setup for Playwright E2E Tests
 * 
 * This file runs once before all E2E tests to set up the test environment.
 * It can be used to:
 * - Start the development server
 * - Seed the database with test data
 * - Create test users and workspaces
 * - Authenticate and save storage state
 */

import { chromium, type FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
// import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');

  const { baseURL, storageState } = config.projects[0].use;

  // Run database migrations if needed
  if (process.env.CI) {
    console.log('📦 Setting up test database...');
    try {
      execSync('pnpm db:migrate:prod', { stdio: 'inherit' });
    } catch (error) {
      console.warn('⚠️  Database migration may have failed, continuing anyway...');
    }
  }

  // Seed test data if needed
  if (process.env.SEED_TEST_DATA === 'true') {
    console.log('🌱 Seeding test data...');
    try {
      execSync('pnpm db:seed', { stdio: 'inherit' });
    } catch (error) {
      console.warn('⚠️  Database seeding may have failed, continuing anyway...');
    }
  }

  // Create authenticated state for tests
  if (storageState) {
    console.log('🔐 Creating authenticated browser state...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Navigate to login page
    await page.goto(`${baseURL}/login`);

    // Perform login
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for navigation to dashboard
    await page.waitForURL(/\/dashboard/);

    // Save storage state
    await page.context().storageState({ path: storageState as string });

    await browser.close();
    console.log('✅ Authenticated state saved');
  }

  console.log('✅ Global setup complete');
}

export default globalSetup;
