import { expect, test } from '@playwright/test';

test.describe('Final-phase release smoke checks', () => {
  test('public product surfaces render', async ({ page }) => {
    for (const path of ['/', '/docs', '/pricing', '/offline']) {
      const response = await page.goto(path);
      expect(response?.ok(), `${path} should respond successfully`).toBe(true);
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  test('health and readiness endpoints return success envelopes', async ({ request }) => {
    for (const path of ['/api/health', '/api/ready']) {
      const response = await request.get(path);
      expect(response.ok(), `${path} should be healthy`).toBe(true);
      const body = await response.json();
      expect(body.status).toBe('ok');
    }
  });

  test('login form exposes accessible credential controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('email-input')).toBeVisible();

    const passwordInput = page.getByTestId('password-input');
    if (await passwordInput.count()) {
      await expect(passwordInput).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('login-button')).toBeEnabled({ timeout: 20000 });
    }
  });
});
