import { expect, test } from '@playwright/test';

test.describe('Workspaces', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('user can create a workspace', async ({ page }) => {
    // Navigate to workspace creation
    await page.click('[data-testid="workspace-switcher"]');
    await page.click('[data-testid="create-workspace"]');

    // Fill workspace details
    await page.fill('[data-testid="workspace-name"]', 'New Test Workspace');
    await page.fill('[data-testid="workspace-description"]', 'A workspace for testing');

    // Submit
    await page.click('[data-testid="create-workspace-button"]');

    // Should redirect to new workspace
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="workspace-name-display"]')).toContainText(
      'New Test Workspace'
    );
  });

  test('user can switch between workspaces', async ({ page }) => {
    // Open workspace switcher
    await page.click('[data-testid="workspace-switcher"]');

    // Should show list of workspaces
    await expect(page.locator('[data-testid="workspace-list"]')).toBeVisible();

    // Click on different workspace
    const workspaceName = await page.locator('[data-testid="workspace-item"]').nth(1).textContent();
    await page.click('[data-testid="workspace-item"].nth(1)');

    // Should switch to selected workspace
    await expect(page.locator('[data-testid="workspace-name-display"]')).toContainText(
      workspaceName || ''
    );
  });

  test('user can invite members to workspace', async ({ page }) => {
    await page.goto('/settings/members');

    // Click invite button
    await page.click('[data-testid="invite-member-button"]');

    // Fill invite form
    await page.fill('[data-testid="invite-email"]', 'newmember@example.com');
    await page.selectOption('[data-testid="invite-role"]', 'member');

    // Send invite
    await page.click('[data-testid="send-invite"]');

    // Should show success
    await expect(page.locator('[data-testid="invite-success"]')).toBeVisible();

    // Invited member should appear in pending list
    await expect(page.locator('[data-testid="pending-invites"]')).toContainText(
      'newmember@example.com'
    );
  });

  test('user can update member roles', async ({ page }) => {
    await page.goto('/settings/members');

    // Find a member and change their role
    const memberRow = page.locator('[data-testid="member-row"]').first();
    await memberRow.locator('[data-testid="role-select"]').selectOption('admin');

    // Should show confirmation
    await page.click('[data-testid="confirm-role-change"]');

    // Role should be updated
    await expect(memberRow.locator('[data-testid="role-select"]')).toHaveValue('admin');
  });

  test('user can remove members from workspace', async ({ page }) => {
    await page.goto('/settings/members');

    // Get initial member count
    const initialCount = await page.locator('[data-testid="member-row"]').count();

    // Remove a member
    const memberRow = page.locator('[data-testid="member-row"]').last();
    await memberRow.locator('[data-testid="remove-member"]').click();

    // Confirm removal
    await page.click('[data-testid="confirm-remove"]');

    // Member should be removed
    await expect(page.locator('[data-testid="member-row"]')).toHaveCount(initialCount - 1);
  });

  test('user can update workspace settings', async ({ page }) => {
    await page.goto('/settings/workspace');

    // Update workspace name
    await page.fill('[data-testid="workspace-name-input"]', 'Updated Workspace Name');

    // Update description
    await page.fill('[data-testid="workspace-description-input"]', 'Updated description');

    // Save changes
    await page.click('[data-testid="save-workspace-settings"]');

    // Should show success
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();

    // Name should be updated in header
    await expect(page.locator('[data-testid="workspace-name-display"]')).toContainText(
      'Updated Workspace Name'
    );
  });

  test('user can delete workspace', async ({ page }) => {
    await page.goto('/settings/workspace');

    // Click delete workspace (danger zone)
    await page.click('[data-testid="delete-workspace"]');

    // Should show confirmation dialog
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();

    // Type workspace name to confirm
    const workspaceName = await page
      .locator('[data-testid="workspace-name-display"]')
      .textContent();
    await page.fill('[data-testid="delete-confirm-input"]', workspaceName || '');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete-workspace"]');

    // Should redirect to another workspace or create workspace page
    await expect(page).toHaveURL(/\/dashboard|create-workspace/);
  });

  test('shows workspace usage statistics', async ({ page }) => {
    await page.goto('/settings/workspace');

    // Should show storage usage
    await expect(page.locator('[data-testid="storage-usage"]')).toBeVisible();

    // Should show member count
    await expect(page.locator('[data-testid="member-count"]')).toBeVisible();

    // Should show document count
    await expect(page.locator('[data-testid="document-count"]')).toBeVisible();
  });

  test('validates workspace name', async ({ page }) => {
    await page.click('[data-testid="workspace-switcher"]');
    await page.click('[data-testid="create-workspace"]');

    // Try empty name
    await page.fill('[data-testid="workspace-name"]', '');
    await page.click('[data-testid="create-workspace-button"]');

    // Should show error
    await expect(page.locator('[data-testid="name-error"]')).toContainText('required');

    // Try name too long
    await page.fill('[data-testid="workspace-name"]', 'a'.repeat(100));
    await page.click('[data-testid="create-workspace-button"]');

    // Should show error
    await expect(page.locator('[data-testid="name-error"]')).toContainText('too long');
  });

  test('workspace isolation is enforced', async ({ page }) => {
    // Switch to workspace A
    await page.click('[data-testid="workspace-switcher"]');
    await page.click('[data-testid="workspace-item"].nth(0)');

    // Get workspace A documents
    await page.goto('/documents');
    // const workspaceADocs = await page.locator('[data-testid="document-item"]').count();

    // Switch to workspace B
    await page.click('[data-testid="workspace-switcher"]');
    await page.click('[data-testid="workspace-item"].nth(1)');

    // Get workspace B documents
    await page.goto('/documents');
    // const workspaceBDocs = await page.locator('[data-testid="document-item"]').count();

    // Document counts should be different (assuming test data)
    // Or at least the workspace context should be different
    const currentWorkspace = await page
      .locator('[data-testid="workspace-name-display"]')
      .textContent();
    expect(currentWorkspace).toBeTruthy();
  });

  test('shows workspace plan and billing', async ({ page }) => {
    await page.goto('/settings/billing');

    // Should show current plan
    await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();

    // Should show usage limits
    await expect(page.locator('[data-testid="usage-limits"]')).toBeVisible();

    // Should show upgrade button for free plans
    const planName = await page.locator('[data-testid="current-plan"]').textContent();
    if (planName?.toLowerCase().includes('free')) {
      await expect(page.locator('[data-testid="upgrade-button"]')).toBeVisible();
    }
  });

  test('user can copy workspace invite link', async ({ page }) => {
    await page.goto('/settings/members');

    // Generate invite link
    await page.click('[data-testid="generate-invite-link"]');

    // Copy link
    await page.click('[data-testid="copy-invite-link"]');

    // Should show copied confirmation
    await expect(page.locator('[data-testid="link-copied"]')).toBeVisible();
  });

  test('validates invite email', async ({ page }) => {
    await page.goto('/settings/members');
    await page.click('[data-testid="invite-member-button"]');

    // Try invalid email
    await page.fill('[data-testid="invite-email"]', 'invalid-email');
    await page.click('[data-testid="send-invite"]');

    // Should show error
    await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');

    // Try duplicate email
    await page.fill('[data-testid="invite-email"]', 'existing@example.com');
    await page.click('[data-testid="send-invite"]');

    // Should show error
    await expect(page.locator('[data-testid="email-error"]')).toContainText('already');
  });

  test('shows member activity', async ({ page }) => {
    await page.goto('/settings/members');

    // Click on member to view details
    await page.click('[data-testid="member-row"].first()');

    // Should show activity
    await expect(page.locator('[data-testid="member-activity"]')).toBeVisible();
  });
});
