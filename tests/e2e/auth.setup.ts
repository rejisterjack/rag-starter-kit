/**
 * Auth Setup for Playwright
 *
 * This file authenticates a user and saves the storage state,
 * which can be reused by other tests to avoid logging in repeatedly.
 */

import { expect, test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authenticated state...');

  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.fill('[data-testid="email-input"]', 'test@example.com');
  await page.fill('[data-testid="password-input"]', 'TestPassword123!');

  // Click login button
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard');

  // Verify we're logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication state saved');
});
