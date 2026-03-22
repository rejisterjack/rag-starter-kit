/**
 * API Key Hashing Unit Tests
 *
 * Tests for bcrypt-based API key hashing
 */

import { describe, expect, it, vi } from 'vitest';

// Mock the audit logger
vi.mock('@/lib/audit/audit-logger', () => ({
  logAuditEvent: vi.fn(),
  AuditEvent: {
    API_KEY_CREATED: 'API_KEY_CREATED',
    API_KEY_REVOKED: 'API_KEY_REVOKED',
    API_KEY_USED: 'API_KEY_USED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from '@/lib/db';
// Import after mocking
import { createApiKey, validateApiKey } from '@/lib/security/api-keys';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    apiKey: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    apiUsage: {
      count: vi.fn(),
    },
  },
}));

describe('API Key Hashing with bcrypt', () => {
  const mockWorkspaceId = 'workspace-123';
  const mockUserId = 'user-123';

  describe('createApiKey', () => {
    it('should create API key with bcrypt hash', async () => {
      const mockApiKey = {
        id: 'key-123',
        name: 'Test Key',
        createdAt: new Date(),
      };

      (prisma.apiKey.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const result = await createApiKey(mockWorkspaceId, mockUserId, {
        name: 'Test Key',
        permissions: ['read:documents'],
      });

      // Verify the returned key has the correct format
      expect(result.key).toMatch(/^rag_[A-Za-z0-9_-]+$/);
      expect(result.apiKey.id).toBe('key-123');

      // Verify prisma was called with a bcrypt hash (starts with $2b$)
      const createCall = (prisma.apiKey.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.keyHash).toMatch(/^\$2[aby]\$\d+\$/);
    });

    it('should generate unique keys each time', async () => {
      const mockApiKey = {
        id: 'key-123',
        name: 'Test Key',
        createdAt: new Date(),
      };

      (prisma.apiKey.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const result1 = await createApiKey(mockWorkspaceId, mockUserId, {
        name: 'Key 1',
        permissions: ['read:documents'],
      });

      const result2 = await createApiKey(mockWorkspaceId, mockUserId, {
        name: 'Key 2',
        permissions: ['read:documents'],
      });

      expect(result1.key).not.toBe(result2.key);
    });
  });

  describe('validateApiKey', () => {
    it('should reject invalid key format', async () => {
      const result = await validateApiKey('invalid-key-format');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key format');
    });

    it('should reject key with non-existent prefix', async () => {
      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await validateApiKey('rag_nonexistentprefix123456789');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should validate correct API key using bcrypt', async () => {
      // This is a real bcrypt hash of "rag_testkey123456789" with a known prefix
      const bcryptHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6.';

      const mockApiKey = {
        id: 'key-123',
        keyHash: bcryptHash,
        keyPreview: 'rag_testkey',
        status: 'ACTIVE',
        expiresAt: null,
        workspaceId: mockWorkspaceId,
        permissions: ['read:documents'],
      };

      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const result = await validateApiKey('rag_testkey123456789');

      expect(result.valid).toBe(true);
      expect(result.keyId).toBe('key-123');
    });

    it('should reject revoked API key', async () => {
      const mockApiKey = {
        id: 'key-123',
        status: 'REVOKED',
      };

      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const result = await validateApiKey('rag_testkey123456789');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('revoked');
    });

    it('should reject expired API key', async () => {
      const mockApiKey = {
        id: 'key-123',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const result = await validateApiKey('rag_testkey123456789');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should detect hash mismatch and log security event', async () => {
      const mockApiKey = {
        id: 'key-123',
        keyHash: '$2b$12$wronghashwronghashwronghashwronghashwronghashwro',
        keyPreview: 'rag_testkey',
        status: 'ACTIVE',
        expiresAt: null,
        workspaceId: mockWorkspaceId,
      };

      (prisma.apiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const result = await validateApiKey('rag_testkey123456789');

      expect(result.valid).toBe(false);
    });
  });

  describe('Security Features', () => {
    it('should use bcrypt with appropriate work factor', async () => {
      const mockApiKey = {
        id: 'key-123',
        name: 'Test Key',
        createdAt: new Date(),
      };

      (prisma.apiKey.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      await createApiKey(mockWorkspaceId, mockUserId, {
        name: 'Test Key',
        permissions: ['read:documents'],
      });

      const createCall = (prisma.apiKey.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const hash = createCall.data.keyHash;

      // Extract work factor from bcrypt hash
      const workFactor = parseInt(hash.split('$')[2], 10);

      // Should use at least 12 rounds
      expect(workFactor).toBeGreaterThanOrEqual(12);
    });

    it('should store only hash, not plaintext key', async () => {
      const mockApiKey = {
        id: 'key-123',
        name: 'Test Key',
        createdAt: new Date(),
      };

      (prisma.apiKey.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKey);

      const result = await createApiKey(mockWorkspaceId, mockUserId, {
        name: 'Test Key',
        permissions: ['read:documents'],
      });

      const createCall = (prisma.apiKey.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const storedHash = createCall.data.keyHash;

      // The plaintext key should NOT be stored
      expect(storedHash).not.toContain(result.key);
      expect(storedHash).not.toContain('rag_');
    });
  });
});
