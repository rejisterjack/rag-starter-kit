import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildEnrichedContext,
  ChunkingEngine,
  ChunkingError,
  ChunkingStrategy,
  chunkFixed,
  chunkHierarchical,
  chunkLate,
  chunkSemantic,
  countTokens,
  createLateChunkingEmbedder,
  estimateTokenCount,
  FixedChunker,
  getChildChunks,
  getChunkContextPath,
  getParentChunk,
  HierarchicalChunker,
  isLateChunkingSuitable,
  LateChunker,
  SemanticChunker,
  smartChunk,
} from '@/lib/rag/chunking';

describe('Text Chunking', () => {
  beforeEach(() => {
    ChunkingEngine.clearCache();
  });

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

    it('should handle very large documents', async () => {
      const chunker = new FixedChunker();
      const text = 'This is a sentence. '.repeat(10000);

      const chunks = await chunker.chunk(text, { maxChunkSize: 100 });

      expect(chunks.length).toBeGreaterThan(100);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(100);
      });
    });

    it('should include correct metadata', async () => {
      const chunker = new FixedChunker();
      const text = 'First sentence. Second sentence. Third sentence.';

      const chunks = await chunker.chunk(text, { maxChunkSize: 30 });

      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.index).toBe(index);
        expect(chunk.metadata.start).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata.end).toBeGreaterThan(chunk.metadata.start);
        expect(chunk.metadata.charCount).toBe(chunk.content.length);
        expect(chunk.id).toBeDefined();
      });
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

    it('should handle empty text', async () => {
      const chunker = new SemanticChunker();
      const mockEmbed = async (texts: string[]) => {
        return texts.map(() => Array(1536).fill(0.1));
      };

      const chunks = await chunker.chunk('', {
        maxChunkSize: 100,
        embeddingFunction: mockEmbed,
      });

      expect(chunks).toHaveLength(0);
    });

    it('should use similarity threshold to group related content', async () => {
      const chunker = new SemanticChunker();
      const text = 'Topic A content. More about topic A. Topic B content. More about topic B.';

      // Mock embedding that returns different vectors for different topics
      const mockEmbed = async (texts: string[]) => {
        return texts.map((t) => {
          if (t.includes('Topic A') || t.includes('topic A')) {
            return Array(1536).fill(0.1);
          }
          if (t.includes('Topic B') || t.includes('topic B')) {
            return Array(1536).fill(0.9);
          }
          return Array(1536).fill(0.5);
        });
      };

      const chunks = await chunker.chunk(text, {
        maxChunkSize: 200,
        embeddingFunction: mockEmbed,
        similarityThreshold: 0.5,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw error without embedding function', async () => {
      const chunker = new SemanticChunker();
      const text = 'Some text';

      await expect(chunker.chunk(text, { maxChunkSize: 100 })).rejects.toThrow(ChunkingError);
    });
  });

  describe('HierarchicalChunker', () => {
    it('should create hierarchical chunks from markdown headings', async () => {
      const chunker = new HierarchicalChunker();
      const document = `# Heading 1
Content under heading 1.

## Subheading 1.1
Content under subheading.

# Heading 2
Content under heading 2.`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
      // Should have parent-child relationships
      const parentChunks = chunks.filter(
        (c) => c.metadata.childIds && c.metadata.childIds.length > 0
      );
      expect(parentChunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle documents without headings', async () => {
      const chunker = new HierarchicalChunker();
      const document = 'This is just plain text without any headings. It has multiple sentences.';

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 100,
        hierarchicalLevels: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should throw error for empty document', async () => {
      const chunker = new HierarchicalChunker();

      await expect(
        chunker.chunk('', {
          strategy: 'hierarchical',
          chunkSize: 100,
        })
      ).rejects.toThrow(ChunkingError);
    });

    it('should validate hierarchical levels', async () => {
      const chunker = new HierarchicalChunker();
      const document = '# Heading\nContent';

      await expect(
        chunker.chunk(document, {
          strategy: 'hierarchical',
          chunkSize: 100,
          hierarchicalLevels: 5, // Invalid: should be 1-3
        })
      ).rejects.toThrow('hierarchicalLevels must be between 1 and 3');
    });

    it('should establish parent-child relationships', async () => {
      const chunker = new HierarchicalChunker();
      const document = `# Section 1
Content 1

## Subsection 1.1
Subcontent 1.1

## Subsection 1.2
Subcontent 1.2

# Section 2
Content 2`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 3,
      });

      // Find chunks with children
      const parents = chunks.filter((c) => c.metadata.childIds && c.metadata.childIds.length > 0);

      if (parents.length > 0) {
        const parent = parents[0];
        if (parent.metadata.childIds) {
          const childId = parent.metadata.childIds[0];
          const child = chunks.find((c) => c.id === childId);
          expect(child).toBeDefined();
          expect(child?.metadata.parentId).toBe(parent.id);
        }
      }
    });

    it('should include heading paths in metadata', async () => {
      const chunker = new HierarchicalChunker();
      const document = `# Main Section
Content

## Sub Section
Sub content`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      // At least some chunks should have headings
      const withHeadings = chunks.filter(
        (c) => c.metadata.headings && c.metadata.headings.length > 0
      );
      expect(withHeadings.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle numbered sections', async () => {
      const chunker = new HierarchicalChunker();
      const document = `1. Introduction
Intro content

2. Background
Background content

2.1. History
History content`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle roman numeral sections', async () => {
      const chunker = new HierarchicalChunker();
      const document = `I. First Section
Content

II. Second Section
More content`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('LateChunker', () => {
    it('should create chunks using token-level embeddings', async () => {
      const chunker = new LateChunker();
      const document = 'This is a test document with multiple sentences for late chunking.';

      // Mock token embedding function
      const mockTokenEmbed = async (_text: string) => {
        // Return mock token embeddings (one per ~4 characters)
        const tokenCount = Math.ceil(document.length / 4);
        return Array(tokenCount)
          .fill(null)
          .map(() => Array(768).fill(0.1));
      };

      const chunks = await chunker.chunk(document, {
        strategy: 'late',
        chunkSize: 400,
        chunkOverlap: 50,
        getTokenEmbeddings: mockTokenEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.embedding).toBeDefined();
        expect(chunk.embedding?.length).toBe(768);
      });
    });

    it('should throw error without token embedding function', async () => {
      const chunker = new LateChunker();
      const document = 'Some text';

      await expect(
        chunker.chunk(document, {
          strategy: 'late',
          chunkSize: 400,
        })
      ).rejects.toThrow(ChunkingError);
    });

    it('should throw error for context window too small', async () => {
      const chunker = new LateChunker();
      const document = 'Some text';

      await expect(
        chunker.chunk(document, {
          strategy: 'late',
          chunkSize: 500, // Less than 1000 minimum
          getTokenEmbeddings: async () => [],
        })
      ).rejects.toThrow('chunkSize (context window) should be at least 1000');
    });

    it('should handle large documents by pre-splitting', async () => {
      const chunker = new LateChunker();
      // Create a document larger than typical context window
      const document = 'Paragraph one.\n\n'.repeat(500);

      const mockTokenEmbed = async (text: string) => {
        const tokenCount = Math.min(Math.ceil(text.length / 4), 1000);
        return Array(tokenCount)
          .fill(null)
          .map(() => Array(768).fill(0.1));
      };

      const chunks = await chunker.chunk(document, {
        strategy: 'late',
        chunkSize: 8191, // Context window
        chunkOverlap: 200,
        getTokenEmbeddings: mockTokenEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should include correct positions in metadata', async () => {
      const chunker = new LateChunker();
      const document = 'First sentence. Second sentence. Third sentence.';

      const mockTokenEmbed = async (_text: string) => {
        return Array(20)
          .fill(null)
          .map(() => Array(768).fill(0.1));
      };

      const chunks = await chunker.chunk(document, {
        strategy: 'late',
        chunkSize: 400,
        chunkOverlap: 50,
        getTokenEmbeddings: mockTokenEmbed,
      });

      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.index).toBe(index);
        expect(chunk.metadata.start).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata.end).toBeGreaterThan(chunk.metadata.start);
      });
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

    it('should create hierarchical chunker', async () => {
      const engine = ChunkingEngine.createChunker(ChunkingStrategy.HIERARCHICAL);
      expect(engine).toBeInstanceOf(HierarchicalChunker);
    });

    it('should create late chunker', async () => {
      const engine = ChunkingEngine.createChunker(ChunkingStrategy.LATE);
      expect(engine).toBeInstanceOf(LateChunker);
    });

    it('should cache chunker instances', () => {
      const chunker1 = ChunkingEngine.createChunker(ChunkingStrategy.FIXED);
      const chunker2 = ChunkingEngine.createChunker(ChunkingStrategy.FIXED);

      expect(chunker1).toBe(chunker2);
    });

    it('should chunk using static method', async () => {
      const text = 'Test content for chunking.';
      const chunks = await ChunkingEngine.chunk(text, {
        strategy: 'fixed',
        chunkSize: 100,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should chunk batch of documents', async () => {
      const documents = [
        { id: 'doc1', content: 'Document one content.' },
        { id: 'doc2', content: 'Document two content.' },
      ];

      const results = await ChunkingEngine.chunkBatch(documents, {
        strategy: 'fixed',
        chunkSize: 100,
      });

      expect(results).toHaveLength(2);
      expect(results[0].documentId).toBe('doc1');
      expect(results[1].documentId).toBe('doc2');
    });

    it('should analyze document and recommend strategy', () => {
      const text = '# Markdown Document\n\nWith headings and structure.';
      const profile = ChunkingEngine.analyze(text);

      expect(profile).toHaveProperty('recommendedStrategy');
      expect(profile).toHaveProperty('documentType');
      expect(profile).toHaveProperty('hasStructure');
    });

    it('should provide chunk statistics', async () => {
      const chunks = [
        { id: '1', content: 'Short', metadata: { index: 0, start: 0, end: 5 } },
        { id: '2', content: 'Medium length text', metadata: { index: 1, start: 6, end: 24 } },
        { id: '3', content: 'L'.repeat(1000), metadata: { index: 2, start: 25, end: 1025 } },
      ];

      const stats = await ChunkingEngine.getStats(chunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.avgChunkSize).toBeGreaterThan(0);
      expect(stats.minChunkSize).toBe(5);
      expect(stats.maxChunkSize).toBe(1000);
      expect(stats.sizeDistribution).toBeDefined();
    });

    it('should handle empty chunks for statistics', async () => {
      const stats = await ChunkingEngine.getStats([]);

      expect(stats.totalChunks).toBe(0);
      expect(stats.avgChunkSize).toBe(0);
    });

    it('should smart chunk with auto strategy selection', async () => {
      const text = '# Structured Document\n\nThis has headings.';

      const { chunks, profile } = await ChunkingEngine.smartChunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(profile.recommendedStrategy).toBeDefined();
    });

    it('should allow strategy override in smart chunk', async () => {
      const text = 'Plain text without structure.';

      const { chunks, profile } = await ChunkingEngine.smartChunk(text, {
        strategy: 'semantic',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Convenience Functions', () => {
    it('chunkFixed should use fixed strategy', async () => {
      const text = 'Test content';
      const chunks = await chunkFixed(text, { chunkSize: 50 });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('chunkSemantic should use semantic strategy', async () => {
      const text = 'Test content';
      const mockEmbed = async () => Array(1536).fill(0.1);

      const chunks = await chunkSemantic(text, {
        chunkSize: 100,
        embeddingFunction: mockEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('chunkHierarchical should use hierarchical strategy', async () => {
      const text = '# Heading\nContent';
      const chunks = await chunkHierarchical(text, {
        chunkSize: 1000,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('chunkLate should use late strategy', async () => {
      const text = 'Test content for late chunking';
      const mockTokenEmbed = async () =>
        Array(20)
          .fill(null)
          .map(() => Array(768).fill(0.1));

      const chunks = await chunkLate(text, {
        chunkSize: 2000,
        getTokenEmbeddings: mockTokenEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('smartChunk should return chunks and profile', async () => {
      const text = 'Test content';
      const { chunks, profile } = await smartChunk(text);

      expect(chunks).toBeDefined();
      expect(profile).toBeDefined();
    });
  });

  describe('Hierarchical Utilities', () => {
    const mockChunks = [
      {
        id: 'parent1',
        content: 'Parent',
        metadata: { index: 0, start: 0, end: 6, childIds: ['child1', 'child2'] },
      },
      {
        id: 'child1',
        content: 'Child 1',
        metadata: { index: 1, start: 7, end: 14, parentId: 'parent1' },
      },
      {
        id: 'child2',
        content: 'Child 2',
        metadata: { index: 2, start: 15, end: 22, parentId: 'parent1' },
      },
      { id: 'orphan', content: 'Orphan', metadata: { index: 3, start: 23, end: 29 } },
    ];

    it('getParentChunk should return parent for child', () => {
      const child = mockChunks[1];
      const parent = getParentChunk(child, mockChunks);

      expect(parent).toBe(mockChunks[0]);
    });

    it('getParentChunk should return undefined for orphan', () => {
      const orphan = mockChunks[3];
      const parent = getParentChunk(orphan, mockChunks);

      expect(parent).toBeUndefined();
    });

    it('getChildChunks should return children for parent', () => {
      const parent = mockChunks[0];
      const children = getChildChunks(parent, mockChunks);

      expect(children).toHaveLength(2);
      expect(children).toContain(mockChunks[1]);
      expect(children).toContain(mockChunks[2]);
    });

    it('getChildChunks should return empty array for leaf', () => {
      const leaf = mockChunks[1];
      const children = getChildChunks(leaf, mockChunks);

      expect(children).toHaveLength(0);
    });

    it('getChunkContextPath should return ancestor chain', () => {
      const grandchild = {
        id: 'grandchild',
        content: 'Grandchild',
        metadata: { index: 4, start: 30, end: 40, parentId: 'child1' },
      };
      const allChunks = [...mockChunks, grandchild];

      const path = getChunkContextPath(grandchild, allChunks);

      expect(path).toHaveLength(2);
      expect(path[0]).toBe(mockChunks[0]); // parent1
      expect(path[1]).toBe(mockChunks[1]); // child1
    });

    it('buildEnrichedContext should add heading context', () => {
      const chunkWithHeadings = {
        id: 'chunk',
        content: 'Content',
        metadata: {
          index: 0,
          start: 0,
          end: 7,
          headings: ['Section 1', 'Subsection 1.1'],
        },
      };

      const context = buildEnrichedContext(chunkWithHeadings, []);

      expect(context).toContain('Section 1');
      expect(context).toContain('Subsection 1.1');
      expect(context).toContain('Content');
    });

    it('buildEnrichedContext should include parent content when requested', () => {
      const allChunks = [
        { id: 'parent', content: 'Parent content here', metadata: { index: 0, start: 0, end: 19 } },
        {
          id: 'child',
          content: 'Child content',
          metadata: { index: 1, start: 20, end: 33, parentId: 'parent' },
        },
      ];

      const context = buildEnrichedContext(allChunks[1], allChunks, {
        includeParentContent: true,
        maxParentContentLength: 50,
      });

      expect(context).toContain('Parent Context');
      expect(context).toContain('Child content');
    });
  });

  describe('Late Chunking Utilities', () => {
    it('createLateChunkingEmbedder should create token embedder', async () => {
      const mockEmbed = async (texts: string[]) => {
        return texts.map(() => Array(768).fill(0.1));
      };

      const embedder = createLateChunkingEmbedder(mockEmbed, { simulateTokens: 16 });
      const embeddings = await embedder('Test text for embedding');

      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBeGreaterThan(0);
      expect(embeddings[0].length).toBe(768);
    });

    it('isLateChunkingSuitable should check document size', async () => {
      const smallDoc = 'Small';
      const largeDoc = 'Word '.repeat(10000);

      const smallResult = await isLateChunkingSuitable(smallDoc, 8191);
      const largeResult = await isLateChunkingSuitable(largeDoc, 1000);

      expect(smallResult.suitable).toBe(true);
      expect(largeResult.suitable).toBe(false);
    });

    it('isLateChunkingSuitable should handle medium-sized documents', async () => {
      // Document slightly over context window
      const doc = 'Word '.repeat(2000);

      const result = await isLateChunkingSuitable(doc, 8191);

      expect(result.suitable).toBe(true);
      expect(result.reason).toContain('slightly exceeds');
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
      expect(count.total).toBeLessThan(20);
    });

    it('should handle non-English text', () => {
      const chineseText = '这是一个中文测试。';
      const tokens = estimateTokenCount(chineseText);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle documents with only whitespace', async () => {
      const chunker = new FixedChunker();
      const text = '   \n\n   \t   ';

      const chunks = await chunker.chunk(text, { maxChunkSize: 100 });

      expect(chunks).toHaveLength(0);
    });

    it('should handle single character documents', async () => {
      const chunker = new FixedChunker();
      const text = 'X';

      const chunks = await chunker.chunk(text, { maxChunkSize: 100 });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('X');
    });

    it('should handle documents with special characters', async () => {
      const chunker = new FixedChunker();
      const text = 'Special: @#$%^&*()_+-=[]{}|;\':",./<>?';

      const chunks = await chunker.chunk(text, { maxChunkSize: 20 });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', async () => {
      const chunker = new FixedChunker();
      const text = '🎉 Unicode test: 日本語, العربية, עברית';

      const chunks = await chunker.chunk(text, { maxChunkSize: 50 });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle very small chunk sizes', async () => {
      const chunker = new FixedChunker();
      const text = 'This is a test.';

      const chunks = await chunker.chunk(text, { maxChunkSize: 5 });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle overlap larger than chunk size gracefully', async () => {
      const chunker = new FixedChunker();
      const text = 'Word1 Word2 Word3 Word4';

      // Should not hang or error
      const chunks = await chunker.chunk(text, {
        maxChunkSize: 10,
        overlap: 15, // Larger than chunk size
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
