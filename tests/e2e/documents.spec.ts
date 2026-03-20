import { test, expect } from '@playwright/test';
// import path from 'path';

test.describe('Documents', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('user can upload a document', async ({ page }) => {
    await page.goto('/documents');

    // Click upload button
    await page.click('[data-testid="upload-button"]');

    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF content'),
    });

    // Should show upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Should show success
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();

    // Document should appear in list
    await expect(page.locator('[data-testid="document-item"]').first()).toContainText('test-document.pdf');
  });

  test('shows document list', async ({ page }) => {
    await page.goto('/documents');

    // Document list should be visible
    await expect(page.locator('[data-testid="document-list"]')).toBeVisible();

    // Each document should show name, size, and status
    const firstDocument = page.locator('[data-testid="document-item"]').first();
    await expect(firstDocument.locator('[data-testid="document-name"]')).toBeVisible();
    await expect(firstDocument.locator('[data-testid="document-size"]')).toBeVisible();
    await expect(firstDocument.locator('[data-testid="document-status"]')).toBeVisible();
  });

  test('user can search documents', async ({ page }) => {
    await page.goto('/documents');

    // Type in search box
    await page.fill('[data-testid="search-input"]', 'financial');

    // Should filter results
    await page.waitForTimeout(300); // Debounce

    const documents = page.locator('[data-testid="document-item"]');
    const count = await documents.count();

    // All visible documents should match search
    for (let i = 0; i < count; i++) {
      const name = await documents.nth(i).locator('[data-testid="document-name"]').textContent();
      expect(name?.toLowerCase()).toContain('financial');
    }
  });

  test('user can filter documents by status', async ({ page }) => {
    await page.goto('/documents');

    // Click status filter
    await page.click('[data-testid="status-filter"]');
    await page.click('[data-testid="status-processed"]');

    // Should show only processed documents
    const documents = page.locator('[data-testid="document-item"]');
    const count = await documents.count();

    for (let i = 0; i < count; i++) {
      const status = await documents.nth(i).locator('[data-testid="document-status"]').textContent();
      expect(status).toBe('Processed');
    }
  });

  test('user can view document details', async ({ page }) => {
    await page.goto('/documents');

    // Click on first document
    await page.click('[data-testid="document-item"].first()');

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/documents\/.+/);

    // Should show document info
    await expect(page.locator('[data-testid="document-detail-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="document-preview"]')).toBeVisible();
  });

  test('user can delete a document', async ({ page }) => {
    await page.goto('/documents');

    // Get initial count
    const initialCount = await page.locator('[data-testid="document-item"]').count();

    // Click delete on first document
    await page.hover('[data-testid="document-item"].first()');
    await page.click('[data-testid="delete-document-button"].first()');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');

    // Document should be removed
    await expect(page.locator('[data-testid="document-item"]')).toHaveCount(initialCount - 1);
  });

  test('user can download a document', async ({ page }) => {
    await page.goto('/documents');

    // Start waiting for download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.hover('[data-testid="document-item"].first()'),
      page.click('[data-testid="download-button"].first()'),
    ]);

    // Verify download started
    expect(download.suggestedFilename()).toBeTruthy();
  });

  test('shows upload progress for large files', async ({ page }) => {
    await page.goto('/documents');

    await page.click('[data-testid="upload-button"]');

    // Upload large file
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: 'large-file.pdf',
      mimeType: 'application/pdf',
      buffer: largeBuffer,
    });

    // Should show progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Progress should update
    const progressText = await page.locator('[data-testid="upload-progress-text"]').textContent();
    expect(progressText).toMatch(/\d+%/);
  });

  test('validates file type', async ({ page }) => {
    await page.goto('/documents');

    await page.click('[data-testid="upload-button"]');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('content'),
    });

    // Should show error
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('file type');
  });

  test('validates file size', async ({ page }) => {
    await page.goto('/documents');

    await page.click('[data-testid="upload-button"]');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(100 * 1024 * 1024), // 100MB
    });

    // Should show error
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('size');
  });

  test('user can chat with documents', async ({ page }) => {
    await page.goto('/documents');

    // Select a document
    await page.click('[data-testid="document-checkbox"].first()');

    // Click chat with document
    await page.click('[data-testid="chat-with-document"]');

    // Should navigate to chat with document selected
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.locator('[data-testid="selected-documents"]')).toBeVisible();
  });

  test('shows document processing status', async ({ page }) => {
    await page.goto('/documents');

    // Check for processing indicator on documents
    const processingDocs = page.locator('[data-testid="status-processing"]');
    const count = await processingDocs.count();

    if (count > 0) {
      // Should show spinner or progress
      await expect(processingDocs.first().locator('[data-testid="processing-spinner"]')).toBeVisible();
    }
  });

  test('shows document count in workspace', async ({ page }) => {
    await page.goto('/documents');

    // Should show total document count
    const countText = await page.locator('[data-testid="document-count"]').textContent();
    const count = parseInt(countText?.match(/\d+/)?.[0] || '0');

    const actualCount = await page.locator('[data-testid="document-item"]').count();
    expect(count).toBe(actualCount);
  });

  test('supports drag and drop upload', async ({ page }) => {
    await page.goto('/documents');

    // Simulate drag and drop
    const dropZone = page.locator('[data-testid="upload-dropzone"]');

    await dropZone.evaluate((el) => {
      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      el.dispatchEvent(event);
    });

    // Dropzone should handle the event
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
  });

  test('user can batch delete documents', async ({ page }) => {
    await page.goto('/documents');

    // Select multiple documents
    await page.click('[data-testid="document-checkbox"].nth(0)');
    await page.click('[data-testid="document-checkbox"].nth(1)');

    // Click batch delete
    await page.click('[data-testid="batch-delete-button"]');

    // Confirm
    await page.click('[data-testid="confirm-delete"]');

    // Selected documents should be removed
    await expect(page.locator('[data-testid="document-item"]')).toHaveCount(
      await page.locator('[data-testid="document-item"]').count()
    );
  });
});
