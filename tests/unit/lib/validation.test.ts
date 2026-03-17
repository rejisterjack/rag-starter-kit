import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  documentUploadSchema,
  chatMessageSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
} from '@/lib/validation';

describe('Validation Schemas', () => {
  describe('documentUploadSchema', () => {
    it('validates valid file upload', () => {
      const validData = {
        workspaceId: 'ws-123',
        files: [
          { name: 'document.pdf', size: 1000000, type: 'application/pdf' },
        ],
      };

      expect(() => documentUploadSchema.parse(validData)).not.toThrow();
    });

    it('rejects invalid workspaceId', () => {
      const invalidData = {
        workspaceId: '',
        files: [{ name: 'doc.pdf', size: 1000, type: 'application/pdf' }],
      };

      expect(() => documentUploadSchema.parse(invalidData)).toThrow();
    });

    it('rejects oversized files', () => {
      const invalidData = {
        workspaceId: 'ws-123',
        files: [
          { name: 'huge.pdf', size: 100 * 1024 * 1024, type: 'application/pdf' },
        ],
      };

      expect(() => documentUploadSchema.parse(invalidData)).toThrow('size');
    });

    it('rejects invalid file types', () => {
      const invalidData = {
        workspaceId: 'ws-123',
        files: [
          { name: 'virus.exe', size: 1000, type: 'application/x-msdownload' },
        ],
      };

      expect(() => documentUploadSchema.parse(invalidData)).toThrow('type');
    });
  });

  describe('chatMessageSchema', () => {
    it('validates valid chat message', () => {
      const validData = {
        message: 'Hello, how are you?',
        workspaceId: 'ws-123',
        documentIds: ['doc-1', 'doc-2'],
      };

      expect(() => chatMessageSchema.parse(validData)).not.toThrow();
    });

    it('rejects empty message', () => {
      const invalidData = {
        message: '',
        workspaceId: 'ws-123',
      };

      expect(() => chatMessageSchema.parse(invalidData)).toThrow();
    });

    it('rejects message too long', () => {
      const invalidData = {
        message: 'a'.repeat(10001),
        workspaceId: 'ws-123',
      };

      expect(() => chatMessageSchema.parse(invalidData)).toThrow('long');
    });

    it('validates without optional documentIds', () => {
      const validData = {
        message: 'Hello',
        workspaceId: 'ws-123',
      };

      expect(() => chatMessageSchema.parse(validData)).not.toThrow();
    });
  });

  describe('createWorkspaceSchema', () => {
    it('validates valid workspace creation', () => {
      const validData = {
        name: 'My Workspace',
        description: 'A test workspace',
      };

      expect(() => createWorkspaceSchema.parse(validData)).not.toThrow();
    });

    it('rejects empty name', () => {
      const invalidData = {
        name: '',
      };

      expect(() => createWorkspaceSchema.parse(invalidData)).toThrow();
    });

    it('rejects name too long', () => {
      const invalidData = {
        name: 'a'.repeat(101),
      };

      expect(() => createWorkspaceSchema.parse(invalidData)).toThrow();
    });

    it('allows description to be optional', () => {
      const validData = {
        name: 'My Workspace',
      };

      expect(() => createWorkspaceSchema.parse(validData)).not.toThrow();
    });

    it('rejects description too long', () => {
      const invalidData = {
        name: 'My Workspace',
        description: 'a'.repeat(501),
      };

      expect(() => createWorkspaceSchema.parse(invalidData)).toThrow();
    });
  });

  describe('inviteMemberSchema', () => {
    it('validates valid member invitation', () => {
      const validData = {
        email: 'newmember@example.com',
        role: 'member',
      };

      expect(() => inviteMemberSchema.parse(validData)).not.toThrow();
    });

    it('rejects invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        role: 'member',
      };

      expect(() => inviteMemberSchema.parse(invalidData)).toThrow('email');
    });

    it('rejects invalid role', () => {
      const invalidData = {
        email: 'member@example.com',
        role: 'superuser',
      };

      expect(() => inviteMemberSchema.parse(invalidData)).toThrow();
    });

    it('accepts all valid roles', () => {
      const validRoles = ['owner', 'admin', 'member', 'viewer'];

      validRoles.forEach(role => {
        const data = { email: 'test@example.com', role };
        expect(() => inviteMemberSchema.parse(data)).not.toThrow();
      });
    });
  });
});
