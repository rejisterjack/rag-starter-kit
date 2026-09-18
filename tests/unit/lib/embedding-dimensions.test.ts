/**
 * Embedding Dimension Validation Tests
 *
 * Tests that the startup validation correctly detects dimension mismatches.
 */
import { afterEach, describe, expect, it } from 'vitest';

describe('Embedding Dimension Validation', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns valid for default Google Gemini (768D)', async () => {
    process.env.EMBEDDING_PROVIDER = 'google';
    process.env.EMBEDDING_MODEL = 'gemini-embedding-2';

    const { validateEmbeddingDimensions } = await import('@/lib/ai/embeddings');
    const result = validateEmbeddingDimensions();

    expect(result.valid).toBe(true);
    expect(result.message).toBeNull();
  });

  it('returns invalid for OpenAI text-embedding-3-small (1536D)', async () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';

    const { validateEmbeddingDimensions } = await import('@/lib/ai/embeddings');
    const result = validateEmbeddingDimensions('openai', 'text-embedding-3-small');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('1536');
    expect(result.message).toContain('768');
    expect(result.message).toContain('mismatch');
  });

  it('returns invalid for Ollama all-minilm (384D)', async () => {
    const { validateEmbeddingDimensions } = await import('@/lib/ai/embeddings');
    const result = validateEmbeddingDimensions('ollama', 'all-minilm');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('384');
  });

  it('returns valid for Ollama nomic-embed-text (768D)', async () => {
    const { validateEmbeddingDimensions } = await import('@/lib/ai/embeddings');
    const result = validateEmbeddingDimensions('ollama', 'nomic-embed-text');

    expect(result.valid).toBe(true);
    expect(result.message).toBeNull();
  });

  it('returns valid with warning for unknown model', async () => {
    const { validateEmbeddingDimensions } = await import('@/lib/ai/embeddings');
    const result = validateEmbeddingDimensions('ollama', 'custom-model-xyz');

    expect(result.valid).toBe(true);
    expect(result.message).toContain('Unknown model');
    expect(result.message).toContain('Cannot validate dimensions');
  });

  it('returns invalid for unknown provider', async () => {
    const { validateEmbeddingDimensions } = await import('@/lib/ai/embeddings');
    const result = validateEmbeddingDimensions('unknown' as 'google', 'any-model');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('Unknown embedding provider');
  });
});
