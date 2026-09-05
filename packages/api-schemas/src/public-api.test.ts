import { describe, expect, it } from 'vitest';
import { publicChatRequestSchema } from './public-api';

describe('public API schemas', () => {
  it('preserves an optional workspaceId for client routing', () => {
    const result = publicChatRequestSchema.parse({
      question: 'What is RAG?',
      workspaceId: 'workspace_123',
    });

    expect(result.workspaceId).toBe('workspace_123');
  });

  it('rejects an empty workspaceId', () => {
    const result = publicChatRequestSchema.safeParse({
      question: 'What is RAG?',
      workspaceId: '',
    });

    expect(result.success).toBe(false);
  });
});
