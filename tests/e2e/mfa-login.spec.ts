/**
 * MFA login flow E2E
 *
 * Requires a user with MFA enabled in seed data and E2E_MFA_TOTP_SECRET in env.
 */

import { expect, test } from '@playwright/test';
import * as OTPAuth from 'otpauth';
import { TEST_EMAIL, TEST_PASSWORD } from './fixtures/credentials';

const mfaSecret = process.env.E2E_MFA_TOTP_SECRET;

test.describe('MFA login flow', () => {
  test.skip(!mfaSecret, 'E2E_MFA_TOTP_SECRET not configured');

  test('completes login with TOTP after credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email-input"]', process.env.E2E_MFA_EMAIL || TEST_EMAIL);
    await page.fill(
      '[data-testid="password-input"]',
      process.env.E2E_MFA_PASSWORD || TEST_PASSWORD
    );
    await page.click('[data-testid="login-button"]');

    await expect(page.getByText('Two-Factor Authentication')).toBeVisible({ timeout: 15000 });

    const totp = new OTPAuth.TOTP({
      issuer: 'RAG Starter Kit',
      label: process.env.E2E_MFA_EMAIL || TEST_EMAIL,
      secret: OTPAuth.Secret.fromBase32(mfaSecret),
      digits: 6,
      period: 30,
    });
    const code = totp.generate();

    await page.getByTestId('mfa-code-input').fill(code);
    await page.getByRole('button', { name: /verify and sign in/i }).click();

    await page.waitForURL(/\/(chat|dashboard)/, { timeout: 15000 });
  });
});
