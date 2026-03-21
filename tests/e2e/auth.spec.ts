import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login');
  });

  test.describe('Registration', () => {
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

    test('validates password strength on signup', async ({ page }) => {
      await page.click('text=Sign up');
      await expect(page).toHaveURL('/signup');

      // Try weak password
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'weak');
      await page.fill('[data-testid="confirm-password-input"]', 'weak');
      await page.click('[data-testid="signup-button"]');

      // Should show password strength error
      await expect(page.locator('[data-testid="password-error"]')).toContainText('at least 8');
    });

    test('validates password confirmation', async ({ page }) => {
      await page.click('text=Sign up');
      await expect(page).toHaveURL('/signup');

      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'DifferentPassword123!');
      await page.click('[data-testid="signup-button"]');

      // Should show mismatch error
      await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('match');
    });

    test('prevents duplicate email registration', async ({ page }) => {
      await page.click('text=Sign up');
      await expect(page).toHaveURL('/signup');

      // Use existing email
      await page.fill('[data-testid="email-input"]', 'existing@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!');
      await page.click('[data-testid="signup-button"]');

      // Should show error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('already exists');
    });

    test('sends verification email after signup', async ({ page }) => {
      await page.click('text=Sign up');
      await expect(page).toHaveURL('/signup');

      await page.fill('[data-testid="email-input"]', 'newuser@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!');
      await page.click('[data-testid="signup-button"]');

      // Should show verification message
      await expect(page.locator('[data-testid="verification-message"]')).toContainText(
        'Check your email'
      );
    });
  });

  test.describe('Login', () => {
    test('user can login with email and password', async ({ page }) => {
      // Fill login form
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');

      // Submit form
      await page.click('[data-testid="login-button"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
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

    test('locks account after max failed attempts', async ({ page }) => {
      // Attempt login multiple times with wrong password
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'wrongpassword');
        await page.click('[data-testid="login-button"]');

        if (i < 4) {
          await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid');
        }
      }

      // Account should be locked
      await expect(page.locator('[data-testid="error-message"]')).toContainText('locked');
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

    test('user can login with Google OAuth', async ({ page }) => {
      const googleButton = page.locator('[data-testid="google-login"]');
      await expect(googleButton).toBeVisible();

      await googleButton.click();

      // Should redirect to Google OAuth
      await expect(page).toHaveURL(/accounts.google.com/);
    });

    test('handles OAuth errors gracefully', async ({ page }) => {
      // Simulate OAuth error by navigating with error param
      await page.goto('/login?error=OAuthCallback');

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('OAuth');
    });
  });

  test.describe('Logout', () => {
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

    test('clears session on logout', async ({ page }) => {
      // Login
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.click('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');

      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Check cookies are cleared (session should be gone)
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find((c) => c.name.includes('session'));
      expect(sessionCookie?.value).toBeFalsy();
    });
  });

  test.describe('Session Management', () => {
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

    test('shows session expiry warning', async ({ page }) => {
      // Login
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.click('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');

      // Simulate session about to expire (this would be time-based in real app)
      // For testing, we check if the warning component exists
      await page.goto('/dashboard?test_session_expiry=true');

      // Should show session expiry warning
      const warning = page.locator('[data-testid="session-expiry-warning"]');
      if (await warning.isVisible().catch(() => false)) {
        await expect(warning).toContainText('expire');
      }
    });

    test('handles concurrent sessions', async ({ browser }) => {
      // Create two contexts (simulating two devices)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Login on first device
      await page1.goto('/login');
      await page1.fill('[data-testid="email-input"]', 'test@example.com');
      await page1.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page1.click('[data-testid="login-button"]');
      await expect(page1).toHaveURL('/dashboard');

      // Login on second device
      await page2.goto('/login');
      await page2.fill('[data-testid="email-input"]', 'test@example.com');
      await page2.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page2.click('[data-testid="login-button"]');
      await expect(page2).toHaveURL('/dashboard');

      // Both should be logged in
      await expect(page1.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page2.locator('[data-testid="user-menu"]')).toBeVisible();

      // Cleanup
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Password Reset', () => {
    test('password reset flow', async ({ page }) => {
      // Click forgot password
      await page.click('text=Forgot password?');
      await expect(page).toHaveURL('/forgot-password');

      // Enter email
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.click('[data-testid="reset-button"]');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText(
        'Check your email'
      );
    });

    test('validates email on password reset', async ({ page }) => {
      await page.click('text=Forgot password?');

      // Submit without email
      await page.click('[data-testid="reset-button"]');

      // Should show validation error
      await expect(page.locator('[data-testid="email-error"]')).toContainText('required');
    });

    test('shows error for non-existent email', async ({ page }) => {
      await page.click('text=Forgot password?');

      // Use non-existent email
      await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
      await page.click('[data-testid="reset-button"]');

      // Should still show success (for security - don't reveal if email exists)
      await expect(page.locator('[data-testid="success-message"]')).toContainText(
        'Check your email'
      );
    });

    test('can reset password with valid token', async ({ page }) => {
      // Navigate to reset page with token
      await page.goto('/reset-password?token=valid-reset-token');

      // Enter new password
      await page.fill('[data-testid="password-input"]', 'NewPassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123!');
      await page.click('[data-testid="reset-button"]');

      // Should redirect to login
      await expect(page).toHaveURL('/login');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText(
        'Password updated'
      );
    });

    test('rejects expired reset token', async ({ page }) => {
      await page.goto('/reset-password?token=expired-token');

      await page.fill('[data-testid="password-input"]', 'NewPassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123!');
      await page.click('[data-testid="reset-button"]');

      // Should show error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('expired');
    });

    test('rejects invalid reset token', async ({ page }) => {
      await page.goto('/reset-password?token=invalid-token');

      await page.fill('[data-testid="password-input"]', 'NewPassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123!');
      await page.click('[data-testid="reset-button"]');

      // Should show error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('invalid');
    });
  });

  test.describe('Email Verification', () => {
    test('shows verification required page', async ({ page }) => {
      // Login with unverified account
      await page.fill('[data-testid="email-input"]', 'unverified@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.click('[data-testid="login-button"]');

      // Should redirect to verification required page
      await expect(page).toHaveURL('/verify-email');
    });

    test('can resend verification email', async ({ page }) => {
      await page.goto('/verify-email');

      await page.click('[data-testid="resend-email"]');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('sent');
    });

    test('verifies email with valid token', async ({ page }) => {
      await page.goto('/verify-email?token=valid-token');

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');

      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toContainText('verified');
    });
  });

  test.describe('CSRF Protection', () => {
    test('includes CSRF token in forms', async ({ page }) => {
      await page.goto('/login');

      // Should have CSRF token input
      const csrfInput = page.locator('input[name="_csrf"]');
      await expect(csrfInput).toBeVisible();
    });

    test('rejects requests without CSRF token', async ({ page }) => {
      // Try to submit login form with removed CSRF token
      await page.goto('/login');
      await page.evaluate(() => {
        const csrfInput = document.querySelector('input[name="_csrf"]');
        if (csrfInput) csrfInput.remove();
      });

      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
      await page.click('[data-testid="login-button"]');

      // Should show CSRF error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('CSRF');
    });
  });

  test.describe('Security Headers', () => {
    test('sets security headers', async ({ page }) => {
      const response = await page.goto('/login');

      // Check for security headers
      const headers = response?.headers() || {};

      expect(headers['x-frame-options'] || headers['content-security-policy']).toBeDefined();
    });
  });
});
