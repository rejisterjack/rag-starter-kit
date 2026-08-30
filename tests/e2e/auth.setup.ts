/**
 * Auth Setup for Playwright
 *
 * This file authenticates a user and saves the storage state,
 * which can be reused by other tests to avoid logging in repeatedly.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as setup } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './fixtures/credentials';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authenticated state...');

  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.fill('[data-testid="email-input"]', TEST_EMAIL);
  await page.fill('[data-testid="password-input"]', TEST_PASSWORD);

  // Click login button
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to the authenticated app (login lands on /chat)
  await page.waitForURL(/\/(chat|dashboard)/);

  // Verify we're logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication state saved');
});
