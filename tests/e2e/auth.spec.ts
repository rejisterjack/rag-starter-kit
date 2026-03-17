import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login');
  });

  test('user can sign up and login', async ({ page }) => {
    // Navigate to sign up
    await page.click('text=Sign up');
    await expect(page).toHaveURL('/signup');

    // Fill signup form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!');

    // Submit form
    await page.click('[data-testid="signup-button"]');

    // Should redirect to dashboard after successful signup
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('user can login with email and password', async ({ page }) => {
    // Fill login form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');

    // Submit form
    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('user can login with GitHub OAuth', async ({ page }) => {
    // Click GitHub login button
    const githubButton = page.locator('[data-testid="github-login"]');
    await expect(githubButton).toBeVisible();

    // Note: Actual OAuth flow would require mocking or test credentials
    // This tests that the button is present and clickable
    await githubButton.click();

    // Should redirect to GitHub OAuth
    await expect(page).toHaveURL(/github.com/);
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid');
  });

  test('shows validation errors for empty fields', async ({ page }) => {
    await page.click('[data-testid="login-button"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="email-error"]')).toContainText('required');
    await expect(page.locator('[data-testid="password-error"]')).toContainText('required');
  });

  test('user can logout', async ({ page }) => {
    // Login first
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');

    // Click user menu
    await page.click('[data-testid="user-menu"]');

    // Click logout
    await page.click('[data-testid="logout-button"]');

    // Should redirect to login
    await expect(page).toHaveURL('/login');

    // Should not be able to access protected routes
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('redirects to requested page after login', async ({ page }) => {
    // Try to access protected page while logged out
    await page.goto('/chat');
    
    // Should redirect to login with callback URL
    await expect(page).toHaveURL(/login.*callbackUrl/);

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="login-button"]');

    // Should redirect to originally requested page
    await expect(page).toHaveURL('/chat');
  });

  test('password reset flow', async ({ page }) => {
    // Click forgot password
    await page.click('text=Forgot password?');
    await expect(page).toHaveURL('/forgot-password');

    // Enter email
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="reset-button"]');

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Check your email');
  });

  test('session persists across page reloads', async ({ page }) => {
    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('shows loading state during authentication', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    
    // Click login
    await page.click('[data-testid="login-button"]');

    // Should show loading state
    await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  });
});
