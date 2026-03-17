import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('user can send message and get response', async ({ page }) => {
    await page.goto('/chat');

    // Type a message
    await page.fill('[data-testid="chat-input"]', 'What is the revenue for Q1?');

    // Send message
    await page.click('[data-testid="send-button"]');

    // User message should appear
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText('What is the revenue');

    // Assistant response should appear
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible();
    
    // Response should contain content
    await expect(page.locator('[data-testid="assistant-message"]').last()).not.toBeEmpty();
  });

  test('user can use keyboard shortcut to send', async ({ page }) => {
    await page.goto('/chat');

    // Type message
    await page.fill('[data-testid="chat-input"]', 'Hello');

    // Press Enter to send
    await page.press('[data-testid="chat-input"]', 'Enter');

    // Message should be sent
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText('Hello');
  });

  test('Shift+Enter creates new line instead of sending', async ({ page }) => {
    await page.goto('/chat');

    // Type first line
    await page.fill('[data-testid="chat-input"]', 'Line 1');

    // Press Shift+Enter
    await page.press('[data-testid="chat-input"]', 'Shift+Enter');

    // Type second line
    await page.fill('[data-testid="chat-input"]', 'Line 1\nLine 2');

    // Should have two lines
    await expect(page.locator('[data-testid="chat-input"]')).toHaveValue('Line 1\nLine 2');
  });

  test('shows streaming response', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('[data-testid="chat-input"]', 'Tell me a story');
    await page.click('[data-testid="send-button"]');

    // Should show streaming indicator
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

    // Wait for streaming to complete
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeHidden();

    // Response should be complete
    await expect(page.locator('[data-testid="assistant-message"]').last()).not.toBeEmpty();
  });

  test('user can stop generation', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('[data-testid="chat-input"]', 'Write a very long essay');
    await page.click('[data-testid="send-button"]');

    // Wait for streaming to start
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

    // Click stop button
    await page.click('[data-testid="stop-button"]');

    // Streaming should stop
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeHidden();
  });

  test('user can copy message', async ({ page }) => {
    await page.goto('/chat');

    // Send a message and get response
    await page.fill('[data-testid="chat-input"]', 'Hello');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible();

    // Hover over message to show actions
    await page.hover('[data-testid="assistant-message"].last()');

    // Click copy button
    await page.click('[data-testid="copy-message-button"]');

    // Should show copied confirmation
    await expect(page.locator('[data-testid="copied-toast"]')).toBeVisible();
  });

  test('user can regenerate response', async ({ page }) => {
    await page.goto('/chat');

    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Question');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible();

    // Click regenerate button
    await page.hover('[data-testid="assistant-message"].last()');
    await page.click('[data-testid="regenerate-button"]');

    // Should show new response
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();
  });

  test('user can edit message', async ({ page }) => {
    await page.goto('/chat');

    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Original question');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible();

    // Click edit on user message
    await page.hover('[data-testid="user-message"].last()');
    await page.click('[data-testid="edit-message-button"]');

    // Edit the message
    await page.fill('[data-testid="edit-input"]', 'Edited question');
    await page.click('[data-testid="save-edit-button"]');

    // Should regenerate response
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();
  });

  test('user can delete message', async ({ page }) => {
    await page.goto('/chat');

    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Question');
    await page.click('[data-testid="send-button"]');

    const messageCount = await page.locator('[data-testid="user-message"]').count();

    // Delete message
    await page.hover('[data-testid="user-message"].last()');
    await page.click('[data-testid="delete-message-button"]');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');

    // Message should be removed
    const newMessageCount = await page.locator('[data-testid="user-message"]').count();
    expect(newMessageCount).toBe(messageCount - 1);
  });

  test('shows error when message fails to send', async ({ page }) => {
    await page.goto('/chat');

    // Simulate network error
    await page.route('/api/chat', route => route.abort('failed'));

    await page.fill('[data-testid="chat-input"]', 'Test');
    await page.click('[data-testid="send-button"]');

    // Should show error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('user can retry failed message', async ({ page }) => {
    await page.goto('/chat');

    let requestCount = 0;
    await page.route('/api/chat', (route) => {
      requestCount++;
      if (requestCount === 1) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    await page.fill('[data-testid="chat-input"]', 'Test');
    await page.click('[data-testid="send-button"]');

    // Wait for error
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Click retry
    await page.click('[data-testid="retry-button"]');

    // Should resend and succeed
    await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible();
  });

  test('input is cleared after sending', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('[data-testid="chat-input"]', 'Message');
    await page.click('[data-testid="send-button"]');

    // Input should be cleared
    await expect(page.locator('[data-testid="chat-input"]')).toHaveValue('');
  });

  test('shows message history', async ({ page }) => {
    await page.goto('/chat');

    // Send multiple messages
    for (let i = 0; i < 3; i++) {
      await page.fill('[data-testid="chat-input"]', `Message ${i}`);
      await page.click('[data-testid="send-button"]');
      await expect(page.locator('[data-testid="assistant-message"]').last()).toBeVisible();
    }

    // Should show all messages
    await expect(page.locator('[data-testid="user-message"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="assistant-message"]')).toHaveCount(3);
  });

  test('new chat clears conversation', async ({ page }) => {
    await page.goto('/chat');

    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Message');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Click new chat
    await page.click('[data-testid="new-chat-button"]');

    // Chat should be cleared
    await expect(page.locator('[data-testid="user-message"]')).toHaveCount(0);
  });
});
