import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Authentication Pages
 * 
 * These tests capture screenshots and compare them against baseline images.
 * Run with: pnpm test:e2e --project=visual-regression
 */

test.describe('Auth Pages - Visual Regression', () => {
  test.describe('Login Page', () => {
    test('matches login page screenshot', async ({ page }) => {
      await page.goto('/login');
      
      // Wait for the page to be fully loaded
      await page.waitForSelector('[data-testid="login-button"]');
      
      // Take screenshot and compare
      await expect(page).toHaveScreenshot('login-page.png', {
        fullPage: true,
      });
    });

    test('matches login page with error screenshot', async ({ page }) => {
      await page.goto('/login');
      
      // Trigger an error
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'wrong');
      await page.click('[data-testid="login-button"]');
      
      // Wait for error to appear
      await page.waitForSelector('[data-testid="error-message"]');
      
      await expect(page).toHaveScreenshot('login-page-error.png', {
        fullPage: true,
      });
    });

    test('matches login page mobile screenshot', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/login');
      await page.waitForSelector('[data-testid="login-button"]');
      
      await expect(page).toHaveScreenshot('login-page-mobile.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Signup Page', () => {
    test('matches signup page screenshot', async ({ page }) => {
      await page.goto('/signup');
      
      await page.waitForSelector('[data-testid="signup-button"]');
      
      await expect(page).toHaveScreenshot('signup-page.png', {
        fullPage: true,
      });
    });

    test('matches signup page with validation errors', async ({ page }) => {
      await page.goto('/signup');
      
      // Submit empty form to trigger validation
      await page.click('[data-testid="signup-button"]');
      
      await page.waitForSelector('[data-testid="email-error"]');
      
      await expect(page).toHaveScreenshot('signup-page-validation.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Password Reset Page', () => {
    test('matches forgot password page screenshot', async ({ page }) => {
      await page.goto('/forgot-password');
      
      await page.waitForSelector('[data-testid="reset-button"]');
      
      await expect(page).toHaveScreenshot('forgot-password-page.png', {
        fullPage: true,
      });
    });

    test('matches reset password page screenshot', async ({ page }) => {
      await page.goto('/reset-password?token=test-token');
      
      await page.waitForSelector('[data-testid="reset-button"]');
      
      await expect(page).toHaveScreenshot('reset-password-page.png', {
        fullPage: true,
      });
    });
  });
});
