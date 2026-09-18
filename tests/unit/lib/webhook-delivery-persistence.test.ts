import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWebhookPayload, recordDelivery } from '@/lib/webhooks/delivery';

// Mock the Prisma client used inside recordDelivery's dynamic import
const { mockWebhookDelivery } = vi.hoisted(() => ({
  mockWebhookDelivery: { create: vi.fn().mockResolvedValue({}) },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: { webhookDelivery: mockWebhookDelivery },
}));

describe('recordDelivery persistence (D-13)', () => {
  beforeEach(() => {
    mockWebhookDelivery.create.mockClear();
  });

  it('writes a WebhookDelivery row for a successful delivery', async () => {
    const payload = buildWebhookPayload('webhook.test', { test: true });
    const result = {
      success: true,
      statusCode: 200,
      responseBody: '{"ok":true}',
      durationMs: 120,
      attemptCount: 1,
    };

    await recordDelivery('wh-1', payload, result);

    expect(mockWebhookDelivery.create).toHaveBeenCalledTimes(1);
    const args = mockWebhookDelivery.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      webhookId: 'wh-1',
      event: 'webhook.test',
      statusCode: 200,
      response: '{"ok":true}',
      status: 'DELIVERED',
      retryCount: 0,
      durationMs: 120,
    });
  });

  it('maps a failed multi-attempt delivery to RETRYING', async () => {
    const payload = buildWebhookPayload('document.created', { id: 'd1' });
    const result = {
      success: false,
      error: 'timeout',
      durationMs: 9000,
      attemptCount: 3,
    };

    await recordDelivery('wh-1', payload, result);

    const args = mockWebhookDelivery.create.mock.calls[0][0];
    expect(args.data.status).toBe('RETRYING');
    expect(args.data.retryCount).toBe(2);
    expect(args.data.error).toBe('timeout');
  });

  it('maps a failed first-attempt delivery to FAILED', async () => {
    const payload = buildWebhookPayload('chat.message_sent', { id: 'm1' });
    const result = { success: false, error: 'connection refused', durationMs: 50, attemptCount: 1 };

    await recordDelivery('wh-2', payload, result);

    const args = mockWebhookDelivery.create.mock.calls[0][0];
    expect(args.data.status).toBe('FAILED');
  });

  it('truncates oversized response bodies before persisting', async () => {
    const payload = buildWebhookPayload('webhook.test', { test: true });
    const huge = 'x'.repeat(5000);
    const result = {
      success: true,
      statusCode: 200,
      responseBody: huge,
      durationMs: 10,
      attemptCount: 1,
    };

    await recordDelivery('wh-3', payload, result);

    const args = mockWebhookDelivery.create.mock.calls[0][0];
    expect(args.data.response.length).toBeLessThanOrEqual(2000);
  });

  it('swallows persistence errors instead of throwing', async () => {
    mockWebhookDelivery.create.mockRejectedValueOnce(new Error('db down'));
    const payload = buildWebhookPayload('webhook.test', { test: true });
    const result = { success: true, durationMs: 10, attemptCount: 1 };

    await expect(recordDelivery('wh-4', payload, result)).resolves.toBeUndefined();
  });
});
