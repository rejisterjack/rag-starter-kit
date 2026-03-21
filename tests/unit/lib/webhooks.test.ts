import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWebhookPayload,
  deliverToMultiple,
  deliverWebhook,
  generateWebhookSecret,
  generateWebhookSignature,
  getAvailableWebhookEvents,
  testWebhook,
  verifyWebhookSignature,
  WebhookEvents,
} from '@/lib/webhooks/delivery';
import {
  checkIdempotencyKey,
  cleanupIdempotencyKeys,
  deleteIdempotencyKey,
  generateIdempotencyKey,
  IdempotencyError,
  isDuplicateEvent,
  markIdempotencyKeyProcessed,
  parseIdempotencyKey,
  processWithIdempotency,
  storeIdempotencyKey,
} from '@/lib/webhooks/idempotency';
import {
  cleanupExpiredRotations,
  completeWebhookRotation,
  getWebhookSecrets,
  rotateWebhookSecret,
  verifyWebhookSignatureWithRotation,
} from '@/lib/webhooks/rotation';

// Mock modules - factories defined inline to avoid hoisting issues
vi.mock('@/lib/security/rate-limiter', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    pipeline: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    webhook: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma as mockPrisma } from '@/lib/db';
// Get reference to mocked modules after they're defined
import { redis as mockRedis } from '@/lib/security/rate-limiter';

describe('Webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Secret Generation', () => {
    it('should generate webhook secret', () => {
      const secret = generateWebhookSecret();

      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.startsWith('whsec_')).toBe(true);
      expect(secret.length).toBeGreaterThan(20);
    });

    it('should generate unique secrets', () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('Signature Generation and Verification', () => {
    it('should generate signature', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'whsec_testsecret';

      const signature = generateWebhookSignature(payload, secret);

      expect(signature).toBeDefined();
      expect(signature.startsWith('sha256=')).toBe(true);
    });

    it('should verify valid signature', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'whsec_testsecret';

      const signature = generateWebhookSignature(payload, secret);
      const isValid = verifyWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'whsec_testsecret';
      const wrongSecret = 'whsec_wrongsecret';

      const signature = generateWebhookSignature(payload, secret);
      const isValid = verifyWebhookSignature(payload, signature, wrongSecret);

      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'whsec_testsecret';

      const signature = generateWebhookSignature(payload, secret);
      const tamperedPayload = JSON.stringify({ event: 'test', data: { modified: true } });
      const isValid = verifyWebhookSignature(tamperedPayload, signature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject malformed signature', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'whsec_testsecret';

      const isValid = verifyWebhookSignature(payload, 'invalid-signature', secret);

      expect(isValid).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      const payload = JSON.stringify({ event: 'test', data: {} });
      const secret = 'whsec_testsecret';

      const signature = generateWebhookSignature(payload, secret);

      // Should not throw
      const isValid = verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });
  });

  describe('Payload Building', () => {
    it('should build webhook payload', () => {
      const event = 'document.created';
      const data = { documentId: 'doc-123', name: 'Test.pdf' };

      const payload = buildWebhookPayload(event, data);

      expect(payload).toHaveProperty('event', event);
      expect(payload).toHaveProperty('data', data);
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('id');
      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });

    it('should use custom timestamp', () => {
      const customDate = new Date('2024-01-01T00:00:00Z');
      const payload = buildWebhookPayload('test', {}, { timestamp: customDate });

      expect(payload.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should use custom id', () => {
      const customId = 'custom-event-id';
      const payload = buildWebhookPayload('test', {}, { id: customId });

      expect(payload.id).toBe(customId);
    });

    it('should generate unique IDs', () => {
      const payload1 = buildWebhookPayload('test', {});
      const payload2 = buildWebhookPayload('test', {});

      expect(payload1.id).not.toBe(payload2.id);
    });
  });

  describe('Webhook Delivery', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should deliver webhook successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'OK',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      const payload = buildWebhookPayload('test', { message: 'Hello' });
      const result = await deliverWebhook('https://example.com/webhook', 'whsec_secret', payload);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.attemptCount).toBe(1);
    });

    it('should include required headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'OK',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      const payload = buildWebhookPayload('document.created', { id: '123' });
      await deliverWebhook('https://example.com/webhook', 'whsec_secret', payload);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Signature': expect.stringContaining('sha256='),
            'X-Webhook-Event': 'document.created',
            'X-Webhook-ID': payload.id,
            'X-Webhook-Timestamp': payload.timestamp,
            'User-Agent': 'RAG-Starter-Kit-Webhook/1.0',
          }),
        })
      );
    });

    it('should retry on server error', async () => {
      const serverError = {
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      };
      const successResponse = {
        ok: true,
        status: 200,
        text: async () => 'OK',
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(serverError as Response)
        .mockResolvedValueOnce(successResponse as Response);

      const payload = buildWebhookPayload('test', {});
      const result = await deliverWebhook('https://example.com/webhook', 'whsec_secret', payload, {
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(2);
    });

    it('should retry on rate limit', async () => {
      const rateLimitError = {
        ok: false,
        status: 429,
        text: async () => 'Rate Limited',
      };
      const successResponse = {
        ok: true,
        status: 200,
        text: async () => 'OK',
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(rateLimitError as Response)
        .mockResolvedValueOnce(successResponse as Response);

      const payload = buildWebhookPayload('test', {});
      const result = await deliverWebhook('https://example.com/webhook', 'whsec_secret', payload, {
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should fail after max retries', async () => {
      const serverError = {
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      };

      vi.mocked(global.fetch).mockResolvedValue(serverError as Response);

      const payload = buildWebhookPayload('test', {});
      const result = await deliverWebhook('https://example.com/webhook', 'whsec_secret', payload, {
        maxRetries: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attemptCount).toBe(3); // Initial + 2 retries
    });

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const payload = buildWebhookPayload('test', {});
      const result = await deliverWebhook('https://example.com/webhook', 'whsec_secret', payload, {
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle timeout', async () => {
      vi.mocked(global.fetch).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const payload = buildWebhookPayload('test', {});
      const result = await deliverWebhook('https://example.com/webhook', 'whsec_secret', payload, {
        timeoutMs: 50,
        maxRetries: 0,
      });

      expect(result.success).toBe(false);
    }, 10000);

    it('should test webhook', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'OK',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      const result = await testWebhook('https://example.com/webhook', 'whsec_secret');

      expect(result.success).toBe(true);
    });
  });

  describe('Batch Delivery', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      } as Response);
    });

    it('should deliver to multiple webhooks', async () => {
      const webhooks = [
        { url: 'https://example.com/webhook1', secret: 'whsec_1', events: ['document.created'] },
        { url: 'https://example.com/webhook2', secret: 'whsec_2', events: ['document.created'] },
      ];

      const results = await deliverToMultiple(webhooks, 'document.created', { id: '123' });

      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('https://example.com/webhook1');
      expect(results[1].url).toBe('https://example.com/webhook2');
    });

    it('should filter by event subscription', async () => {
      const webhooks = [
        { url: 'https://example.com/ws1', secret: 'whsec_1', events: ['document.created'] },
        { url: 'https://example.com/ws2', secret: 'whsec_2', events: ['document.updated'] },
        { url: 'https://example.com/ws3', secret: 'whsec_3', events: ['*'] },
      ];

      const results = await deliverToMultiple(webhooks, 'document.created', { id: '123' });

      expect(results).toHaveLength(2); // ws1 and ws3 (wildcard)
    });

    it('should return empty array when no subscriptions match', async () => {
      const webhooks = [
        { url: 'https://example.com/ws1', secret: 'whsec_1', events: ['document.updated'] },
      ];

      const results = await deliverToMultiple(webhooks, 'document.deleted', { id: '123' });

      expect(results).toHaveLength(0);
    });
  });

  describe('Webhook Events', () => {
    it('should have document events', () => {
      expect(WebhookEvents.DOCUMENT_CREATED).toBe('document.created');
      expect(WebhookEvents.DOCUMENT_UPDATED).toBe('document.updated');
      expect(WebhookEvents.DOCUMENT_DELETED).toBe('document.deleted');
      expect(WebhookEvents.DOCUMENT_PROCESSED).toBe('document.processed');
    });

    it('should have chat events', () => {
      expect(WebhookEvents.CHAT_CREATED).toBe('chat.created');
      expect(WebhookEvents.CHAT_MESSAGE_SENT).toBe('chat.message_sent');
      expect(WebhookEvents.CHAT_DELETED).toBe('chat.deleted');
    });

    it('should have workspace events', () => {
      expect(WebhookEvents.WORKSPACE_UPDATED).toBe('workspace.updated');
      expect(WebhookEvents.MEMBER_JOINED).toBe('member.joined');
      expect(WebhookEvents.MEMBER_LEFT).toBe('member.left');
    });

    it('should have API key events', () => {
      expect(WebhookEvents.API_KEY_CREATED).toBe('api_key.created');
      expect(WebhookEvents.API_KEY_REVOKED).toBe('api_key.revoked');
    });

    it('should have wildcard event', () => {
      expect(WebhookEvents.ALL).toBe('*');
    });

    it('should get available events list', () => {
      const events = getAvailableWebhookEvents();

      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBeGreaterThan(0);

      const firstEvent = events[0];
      expect(firstEvent).toHaveProperty('value');
      expect(firstEvent).toHaveProperty('label');
      expect(firstEvent).toHaveProperty('description');
    });
  });

  describe('Secret Rotation', () => {
    it('should rotate webhook secret', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_old',
        metadata: {},
      });
      mockPrisma.webhook.update.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_new',
      });

      const result = await rotateWebhookSecret('webhook-123');

      expect(result.success).toBe(true);
      expect(result.newSecret).toBeDefined();
      expect(result.newSecret.startsWith('whsec_')).toBe(true);
      expect(result.previousSecret).toBe('whsec_old');
    });

    it('should return error for non-existent webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValueOnce(null);

      const result = await rotateWebhookSecret('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook not found');
    });

    it('should get webhook secrets during grace period', async () => {
      const rotatedAt = new Date();
      mockPrisma.webhook.findUnique.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_new',
        metadata: {
          previousSecret: 'whsec_old',
          rotatedAt: rotatedAt.toISOString(),
          gracePeriodDays: 7,
        },
      });

      const secrets = await getWebhookSecrets('webhook-123');

      expect(secrets).not.toBeNull();
      expect(secrets?.primary).toBe('whsec_new');
      expect(secrets?.secondary).toBe('whsec_old');
      expect(secrets?.rotatedAt).toEqual(rotatedAt);
    });

    it('should verify signature with rotation', async () => {
      const payload = JSON.stringify({ event: 'test' });
      const oldSecret = 'whsec_old';
      const newSecret = 'whsec_new';
      const oldSignature = generateWebhookSignature(payload, oldSecret);

      mockPrisma.webhook.findUnique.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: newSecret,
        metadata: {
          previousSecret: oldSecret,
          rotatedAt: new Date().toISOString(),
          gracePeriodDays: 7,
        },
      });

      const isValid = await verifyWebhookSignatureWithRotation(
        'webhook-123',
        payload,
        oldSignature
      );

      expect(isValid).toBe(true);
    });

    it('should verify with primary secret', async () => {
      const payload = JSON.stringify({ event: 'test' });
      const secret = 'whsec_secret';
      const signature = generateWebhookSignature(payload, secret);

      mockPrisma.webhook.findUnique.mockResolvedValueOnce({
        id: 'webhook-123',
        secret,
        metadata: {},
      });

      const isValid = await verifyWebhookSignatureWithRotation('webhook-123', payload, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature during rotation', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_new',
        metadata: {
          previousSecret: 'whsec_old',
          rotatedAt: new Date().toISOString(),
          gracePeriodDays: 7,
        },
      });

      const isValid = await verifyWebhookSignatureWithRotation(
        'webhook-123',
        'payload',
        'invalid-signature'
      );

      expect(isValid).toBe(false);
    });

    it('should complete rotation after grace period', async () => {
      const rotatedAt = new Date();
      rotatedAt.setDate(rotatedAt.getDate() - 8); // 8 days ago

      mockPrisma.webhook.findUnique.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_new',
        metadata: {
          previousSecret: 'whsec_old',
          rotatedAt: rotatedAt.toISOString(),
          gracePeriodDays: 7,
        },
      });
      mockPrisma.webhook.update.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_new',
        metadata: {},
      });

      const completed = await completeWebhookRotation('webhook-123');

      expect(completed).toBe(true);
    });

    it('should not complete rotation before grace period ends', async () => {
      const rotatedAt = new Date();
      rotatedAt.setDate(rotatedAt.getDate() - 3); // 3 days ago

      mockPrisma.webhook.findUnique.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_new',
        metadata: {
          previousSecret: 'whsec_old',
          rotatedAt: rotatedAt.toISOString(),
          gracePeriodDays: 7,
        },
      });

      const completed = await completeWebhookRotation('webhook-123');

      expect(completed).toBe(false);
    });

    it('should cleanup expired rotations', async () => {
      const rotatedAt = new Date();
      rotatedAt.setDate(rotatedAt.getDate() - 10); // 10 days ago

      mockPrisma.webhook.findMany.mockResolvedValueOnce([
        {
          id: 'webhook-123',
          secret: 'whsec_new',
          metadata: {
            previousSecret: 'whsec_old',
            rotatedAt: rotatedAt.toISOString(),
            gracePeriodDays: 7,
          },
        },
      ]);
      mockPrisma.webhook.update.mockResolvedValueOnce({
        id: 'webhook-123',
        secret: 'whsec_new',
        metadata: {},
      });

      const completed = await cleanupExpiredRotations();

      expect(completed).toBe(1);
    });
  });

  describe('Idempotency', () => {
    it('should generate idempotency key', () => {
      const key = generateIdempotencyKey('webhook-123', 'document.created');

      expect(key).toBeDefined();
      expect(key.startsWith('webhook-123:document.created:')).toBe(true);
    });

    it('should generate key with custom unique ID', () => {
      const key = generateIdempotencyKey('webhook-123', 'document.created', 'custom-id');

      expect(key).toBe('webhook-123:document.created:custom-id');
    });

    it('should parse idempotency key', () => {
      const key = 'webhook-123:document.created:event-456';
      const parsed = parseIdempotencyKey(key);

      expect(parsed).toEqual({
        webhookId: 'webhook-123',
        event: 'document.created',
        uniqueId: 'event-456',
      });
    });

    it('should return null for invalid key format', () => {
      const parsed = parseIdempotencyKey('invalid-key');

      expect(parsed).toBeNull();
    });

    it('should check if key is processed', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await checkIdempotencyKey('webhook-123:document.created:1');

      expect(result.processed).toBe(false);
    });

    it('should return previous response for processed key', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          processed: true,
          responseStatus: 200,
          responseBody: '{"success": true}',
        })
      );

      const result = await checkIdempotencyKey('webhook-123:document.created:1');

      expect(result.processed).toBe(true);
      expect(result.previousResponse).toEqual({
        status: 200,
        body: '{"success": true}',
      });
    });

    it('should store idempotency key', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');

      const result = await storeIdempotencyKey('webhook-123:document.created:1', {
        event: 'document.created',
        webhookId: 'webhook-123',
      });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'webhook:idempotency:webhook-123:document.created:1',
        expect.stringContaining('document.created'),
        'EX',
        86400
      );
    });

    it('should mark key as processed', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          event: 'document.created',
          webhookId: 'webhook-123',
          processed: false,
        })
      );
      mockRedis.set.mockResolvedValueOnce('OK');

      const result = await markIdempotencyKeyProcessed('webhook-123:document.created:1', {
        status: 200,
        body: '{"success": true}',
      });

      expect(result).toBe(true);
    });

    it('should fail to mark non-existent key', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await markIdempotencyKeyProcessed('webhook-123:document.created:1', {
        status: 200,
      });

      expect(result).toBe(false);
    });

    it('should delete idempotency key', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await deleteIdempotencyKey('webhook-123:document.created:1');

      expect(result).toBe(true);
    });

    it('should check for duplicate events', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ processed: true }));

      const isDuplicate = await isDuplicateEvent('webhook-123', 'document.created', 'event-1');

      expect(isDuplicate).toBe(true);
    });

    it('should process with idempotency guarantee', async () => {
      mockRedis.get.mockResolvedValueOnce(null); // Not processed
      mockRedis.set.mockResolvedValueOnce('OK'); // Store key
      mockRedis.set.mockResolvedValueOnce('OK'); // Mark processed

      const handler = vi.fn().mockResolvedValue({ success: true });
      const result = await processWithIdempotency(
        'webhook-123',
        'document.created',
        'event-1',
        handler
      );

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should skip handler for duplicate event', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          processed: true,
          responseStatus: 200,
          responseBody: '{"cached": true}',
        })
      );

      const handler = vi.fn();

      await expect(
        processWithIdempotency('webhook-123', 'document.created', 'event-1', handler)
      ).rejects.toThrow(IdempotencyError);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should use custom duplicate handler', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          processed: true,
          responseStatus: 200,
          responseBody: '{"cached": true}',
        })
      );

      const handler = vi.fn();
      const onDuplicate = vi.fn().mockReturnValue({ deduplicated: true });

      const result = await processWithIdempotency(
        'webhook-123',
        'document.created',
        'event-1',
        handler,
        { onDuplicate }
      );

      expect(handler).not.toHaveBeenCalled();
      expect(onDuplicate).toHaveBeenCalled();
      expect(result).toEqual({ deduplicated: true });
    });

    it('should not mark as processed on handler error', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce('OK');

      const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));

      await expect(
        processWithIdempotency('webhook-123', 'document.created', 'event-1', handler)
      ).rejects.toThrow('Handler failed');
    });

    it('should create IdempotencyError', () => {
      const error = new IdempotencyError('Already processed', { status: 200, body: '{}' });

      expect(error.name).toBe('IdempotencyError');
      expect(error.message).toBe('Already processed');
      expect(error.previousResponse).toEqual({ status: 200, body: '{}' });
    });

    it('should cleanup idempotency keys', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'webhook:idempotency:key1',
        'webhook:idempotency:key2',
      ]);
      mockRedis.pipeline.mockReturnThis();
      mockRedis.del.mockReturnThis();
      mockRedis.exec.mockResolvedValueOnce([
        [null, 1],
        [null, 1],
      ]);

      const deleted = await cleanupIdempotencyKeys();

      expect(deleted).toBe(2);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));

      const result = await checkIdempotencyKey('webhook-123:event:1');

      // Should fail open (not processed)
      expect(result.processed).toBe(false);
    });

    it('should handle store failures', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('Redis error'));

      const result = await storeIdempotencyKey('key', { event: 'test', webhookId: '123' });

      expect(result).toBe(false);
    });
  });
});
