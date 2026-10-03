import { describe, expect, it } from 'vitest';
import { publicChatRequestSchema, publicChatStreamEventSchema } from './public-api';

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

  it('accepts every supported streaming event shape', () => {
    const events = [
      { type: 'sources', citations: [{ documentName: 'guide.md' }] },
      { type: 'content', content: 'Hello' },
      { type: 'done', metadata: { latency: 12 } },
      { type: 'error', message: 'Provider unavailable' },
    ];

    for (const event of events) {
      expect(publicChatStreamEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('rejects malformed streaming events', () => {
    expect(publicChatStreamEventSchema.safeParse({ type: 'content', content: 42 }).success).toBe(
      false
    );
    expect(publicChatStreamEventSchema.safeParse({ type: 'unknown' }).success).toBe(false);
  });
});
