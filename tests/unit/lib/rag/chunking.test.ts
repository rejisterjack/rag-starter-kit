import { describe, expect, it } from 'vitest';
import {
  FixedChunker,
  SemanticChunker,
  ChunkingEngine,
  countTokens,
  estimateTokenCount,
  ChunkingStrategy,
} from '@/lib/rag/chunking';

describe('Text Chunking', () => {
  describe('FixedChunker', () => {
    it('should chunk text by size', async () => {
      const chunker = new FixedChunker();
      const text = 'This is a test sentence. Here is another one.';
      
      const chunks = await chunker.chunk(text, { maxChunkSize: 20 });
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content.length).toBeLessThanOrEqual(20);
    });

    it('should handle empty text', async () => {
      const chunker = new FixedChunker();
      const chunks = await chunker.chunk('', { maxChunkSize: 100 });
      
      expect(chunks).toHaveLength(0);
    });

    it('should handle text smaller than chunk size', async () => {
      const chunker = new FixedChunker();
      const text = 'Short text';
      
      const chunks = await chunker.chunk(text, { maxChunkSize: 100 });
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should respect overlap setting', async () => {
      const chunker = new FixedChunker();
      const text = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8';
      
      const chunks = await chunker.chunk(text, {
        maxChunkSize: 20,
        overlap: 5,
      });
      
      if (chunks.length > 1) {
        // Check for overlap
        const firstEnd = chunks[0].content.slice(-5);
        const secondStart = chunks[1].content.slice(0, 5);
        expect(firstEnd).toContain(secondStart.trim());
      }
    });
  });

  describe('SemanticChunker', () => {
    it('should chunk text semantically', async () => {
      const chunker = new SemanticChunker();
      const text = 'First topic sentence. Second topic sentence. Third topic sentence.';
      
      // Mock embedding function
      const mockEmbed = async (texts: string[]) => {
        return texts.map(() => Array(1536).fill(0.1));
      };
      
      const chunks = await chunker.chunk(text, {
        maxChunkSize: 100,
        embeddingFunction: mockEmbed,
      });
      
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('ChunkingEngine', () => {
    it('should create fixed chunker', async () => {
      const engine = ChunkingEngine.createChunker(ChunkingStrategy.FIXED);
      expect(engine).toBeInstanceOf(FixedChunker);
    });

    it('should create semantic chunker', async () => {
      const engine = ChunkingEngine.createChunker(ChunkingStrategy.SEMANTIC);
      expect(engine).toBeInstanceOf(SemanticChunker);
    });

    it('should cache chunker instances', () => {
      const chunker1 = ChunkingEngine.createChunker(ChunkingStrategy.FIXED);
      const chunker2 = ChunkingEngine.createChunker(ChunkingStrategy.FIXED);
      
      expect(chunker1).toBe(chunker2);
    });
  });

  describe('Token Counting', () => {
    it('should count tokens for English text', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const tokens = estimateTokenCount(text);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('should scale with text length', () => {
      const shortText = 'Hello';
      const longText = 'Hello '.repeat(10);
      
      const shortTokens = estimateTokenCount(shortText);
      const longTokens = estimateTokenCount(longText);
      
      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should count tokens accurately', () => {
      const text = 'This is a test.';
      const count = countTokens(text);
      
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20);
    });
  });

  describe('Chunk Metadata', () => {
    it('should include position information', async () => {
      const chunker = new FixedChunker();
      const text = 'First sentence. Second sentence. Third sentence.';
      
      const chunks = await chunker.chunk(text, { maxChunkSize: 30 });
      
      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.index).toBe(index);
        expect(chunk.metadata.start).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata.end).toBeGreaterThan(chunk.metadata.start);
      });
    });

    it('should calculate character count correctly', async () => {
      const chunker = new FixedChunker();
      const text = 'Test content here.';
      
      const chunks = await chunker.chunk(text, { maxChunkSize: 100 });
      
      expect(chunks[0].metadata.charCount).toBe(text.length);
    });
  });
});
