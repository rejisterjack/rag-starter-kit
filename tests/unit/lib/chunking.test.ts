import { describe, it, expect } from 'vitest';
import {
  fixedSizeChunking,
  semanticChunking,
  hierarchicalChunking,
  recursiveChunking,
} from '@/lib/rag/chunking';

describe('Chunking', () => {
  const sampleText = `
    Introduction to Machine Learning

    Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. This technology has revolutionized numerous industries, from healthcare to finance.

    Supervised Learning
    
    In supervised learning, algorithms learn from labeled training data to make predictions. Common applications include classification and regression tasks. Examples include spam detection, image recognition, and price prediction.

    Unsupervised Learning
    
    Unsupervised learning finds patterns in data without labeled outcomes. Clustering and dimensionality reduction are common techniques. Applications include customer segmentation and anomaly detection.

    Deep Learning
    
    Deep learning uses neural networks with multiple layers to model complex patterns. It has achieved remarkable success in computer vision, natural language processing, and game playing.
  `;

  describe('Fixed Size Chunking', () => {
    it('splits text into fixed size chunks', () => {
      const chunks = fixedSizeChunking(sampleText, {
        chunkSize: 200,
        chunkOverlap: 50,
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].content.length).toBeLessThanOrEqual(200);
    });

    it('respects chunk overlap', () => {
      const chunks = fixedSizeChunking(sampleText, {
        chunkSize: 200,
        chunkOverlap: 50,
      });

      if (chunks.length > 1) {
        // Check that consecutive chunks share some content
        const overlap = findOverlap(chunks[0].content, chunks[1].content);
        expect(overlap.length).toBeGreaterThan(0);
      }
    });

    it('handles edge cases', () => {
      // Empty text
      const empty = fixedSizeChunking('', { chunkSize: 100 });
      expect(empty).toHaveLength(0);

      // Text shorter than chunk size
      const short = fixedSizeChunking('Short text', { chunkSize: 100 });
      expect(short).toHaveLength(1);
      expect(short[0].content).toBe('Short text');

      // Text exactly matching chunk size
      const exact = fixedSizeChunking('a'.repeat(100), { chunkSize: 100 });
      expect(exact).toHaveLength(1);
    });

    it('preserves metadata', () => {
      const chunks = fixedSizeChunking(sampleText, {
        chunkSize: 200,
        metadata: { documentId: 'doc-1' },
      });

      expect(chunks[0].metadata).toMatchObject({
        documentId: 'doc-1',
        index: 0,
      });
    });
  });

  describe('Semantic Chunking', () => {
    it('finds semantic boundaries', () => {
      const text = 'First paragraph about topic A.\n\nSecond paragraph about topic B.\n\nThird paragraph about topic C.';
      
      const chunks = semanticChunking(text, {
        minChunkSize: 50,
        maxChunkSize: 300,
      });

      // Should create chunks at paragraph boundaries
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('handles headings as boundaries', () => {
      const textWithHeadings = `
        # Section 1
        Content of section 1 goes here.
        More content here.

        # Section 2
        Content of section 2 goes here.
      `;

      const chunks = semanticChunking(textWithHeadings, {
        minChunkSize: 50,
        maxChunkSize: 500,
      });

      // Each section should ideally be its own chunk
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('handles code blocks as atomic units', () => {
      const textWithCode = `
        Here's some explanation.

        \`\`\`javascript
        const x = 1;
        const y = 2;
        console.log(x + y);
        \`\`\`

        More explanation.
      `;

      const chunks = semanticChunking(textWithCode, {
        minChunkSize: 50,
        maxChunkSize: 300,
      });

      // Code block should not be split
      chunks.forEach(chunk => {
        const codeStarts = (chunk.content.match(/```/g) || []).length;
        expect(codeStarts % 2).toBe(0); // Balanced code fences
      });
    });

    it('respects sentence boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      
      const chunks = semanticChunking(text, {
        minChunkSize: 30,
        maxChunkSize: 50,
      });

      // Should not split mid-sentence
      chunks.forEach(chunk => {
        expect(chunk.content.trim().endsWith('.') || chunk.content.includes('. ')).toBeTruthy();
      });
    });
  });

  describe('Hierarchical Chunking', () => {
    it('creates parent-child relationships', () => {
      const text = `
        # Chapter 1
        Introduction to the topic.

        ## Section 1.1
        Detailed content here.
        More details.

        ## Section 1.2
        More content in section 1.2.
      `;

      const chunks = hierarchicalChunking(text, {
        levels: ['chapter', 'section', 'paragraph'],
        maxChunkSize: 500,
      });

      // Should have hierarchical structure
      expect(chunks.some(c => c.metadata.level === 1)).toBe(true);
    });

    it('preserves document structure', () => {
      const chunks = hierarchicalChunking(sampleText, {
        levels: ['section', 'subsection'],
        maxChunkSize: 500,
      });

      // Check that parent chunks contain child content
      chunks.forEach(chunk => {
        if (chunk.metadata.children) {
          expect(Array.isArray(chunk.metadata.children)).toBe(true);
        }
      });
    });

    it('handles deeply nested documents', () => {
      const nestedText = `
        # Level 1
        ## Level 2
        ### Level 3
        #### Level 4
        Content at level 4.
      `;

      const chunks = hierarchicalChunking(nestedText, {
        levels: ['h1', 'h2', 'h3', 'h4'],
        maxChunkSize: 1000,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Recursive Chunking', () => {
    it('recursively splits oversized chunks', () => {
      const longText = 'word '.repeat(1000);
      
      const chunks = recursiveChunking(longText, {
        chunkSize: 200,
        separators: ['\n\n', '\n', '. ', ' '],
      });

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(200);
      });
    });

    it('tries multiple separators in order', () => {
      const text = 'Para1.\n\nPara2.\nPara3. Sentence1. Sentence2';
      
      const chunks = recursiveChunking(text, {
        chunkSize: 50,
        separators: ['\n\n', '\n', '. '],
      });

      // Should prefer paragraph breaks over sentence breaks
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('falls back to character split if necessary', () => {
      const noSeparatorText = 'a'.repeat(1000);
      
      const chunks = recursiveChunking(noSeparatorText, {
        chunkSize: 200,
        separators: ['\n\n', '\n'],
      });

      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(200);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles text with only whitespace', () => {
      const whitespace = '   \n\n   \t   ';
      
      const chunks = fixedSizeChunking(whitespace, { chunkSize: 100 });
      expect(chunks.length).toBe(0);
    });

    it('handles text with special characters', () => {
      const special = 'Special chars: 🎉 émojis «quotes» ≠≠≠ \x00\x01\x02';
      
      const chunks = fixedSizeChunking(special, { chunkSize: 100 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('🎉');
    });

    it('handles very long words', () => {
      const longWord = 'a'.repeat(1000);
      const text = `Start ${longWord} end`;
      
      const chunks = fixedSizeChunking(text, { chunkSize: 100 });
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('handles markdown tables', () => {
      const table = `
        | Col1 | Col2 | Col3 |
        |------|------|------|
        | A1   | B1   | C1   |
        | A2   | B2   | C2   |
      `;

      const chunks = semanticChunking(table, {
        minChunkSize: 50,
        maxChunkSize: 200,
      });

      // Table should not be split mid-row
      chunks.forEach(chunk => {
        const rows = chunk.content.split('\n').filter(r => r.includes('|'));
        if (rows.length > 1) {
          // All rows should have same column count
          const colCounts = rows.map(r => r.split('|').length);
          expect(new Set(colCounts).size).toBe(1);
        }
      });
    });
  });
});

// Helper function to find overlap between two strings
function findOverlap(str1: string, str2: string): string {
  for (let i = Math.min(str1.length, str2.length); i > 0; i--) {
    if (str1.slice(-i) === str2.slice(0, i)) {
      return str1.slice(-i);
    }
  }
  return '';
}
