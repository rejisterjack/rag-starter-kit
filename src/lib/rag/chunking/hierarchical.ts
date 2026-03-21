/**
 * Hierarchical chunking strategy
 * Creates parent-child relationships between chunks at different granularities
 * Structure: Parent (section) -> Child (paragraph) -> Grandchild (sentence group)
 */

import { FixedChunker } from './fixed';
import { estimateTokenCount } from './tokens';
import type { Chunk, Chunker, ChunkingOptions } from './types';
import { ChunkingError } from './types';
import { generateId } from './utils';

/**
 * Heading patterns for detecting document structure
 */
const DEFAULT_HEADING_PATTERNS = [
  /^#{1,6}\s+(.+)$/m, // Markdown headings
  /^([A-Z][A-Za-z\s]{2,})\n={3,}$/m, // Underlined headings
  /^\d+\.\s+(.+)$/m, // Numbered sections
  /^[A-Z][A-Z\s]{3,}$/m, // ALL CAPS headings (min 4 chars)
  /^\d+\.\d+\.?\s*(.+)$/m, // Subsections like 1.1 or 1.1.
  /^[IVX]+\.\s+(.+)$/m, // Roman numeral sections
];

/**
 * Represents a node in the hierarchical structure
 */
interface HierarchicalNode {
  id: string;
  content: string;
  level: number;
  start: number;
  end: number;
  heading?: string;
  children: HierarchicalNode[];
  parent?: HierarchicalNode;
}

/**
 * Hierarchical chunker implementation
 */
export class HierarchicalChunker implements Chunker {
  private headingPatterns: RegExp[];
  private fixedChunker: FixedChunker;

  constructor(options?: { headingPatterns?: RegExp[] }) {
    this.headingPatterns = options?.headingPatterns ?? DEFAULT_HEADING_PATTERNS;
    this.fixedChunker = new FixedChunker();
  }

  /**
   * Get chunker name
   */
  getName(): string {
    return 'hierarchical';
  }

  /**
   * Validate chunking options
   */
  validateOptions(options: ChunkingOptions): boolean {
    const levels = options.hierarchicalLevels ?? 2;
    if (levels < 1 || levels > 3) {
      throw new ChunkingError('hierarchicalLevels must be between 1 and 3', 'INVALID_OPTIONS', {
        hierarchicalLevels: levels,
      });
    }

    return true;
  }

  /**
   * Chunk the document using hierarchical structure
   */
  async chunk(document: string, options: ChunkingOptions): Promise<Chunk[]> {
    this.validateOptions(options);

    if (!document || document.trim().length === 0) {
      throw new ChunkingError('Document is empty', 'EMPTY_DOCUMENT');
    }

    const levels = options.hierarchicalLevels ?? 2;
    const parseHeadings = options.parseHeadings !== false;

    // Step 1: Parse document structure
    const root = parseHeadings
      ? this.parseDocumentStructure(document)
      : this.createFlatStructure(document);

    // Step 2: Build hierarchy to desired depth
    const chunks: Chunk[] = [];
    await this.buildChunksFromNode(root, document, options.documentId, levels, 0, chunks);

    // Step 3: Flatten and create parent-child relationships
    return this.flattenHierarchy(chunks);
  }

  /**
   * Parse document structure based on headings
   */
  private parseDocumentStructure(document: string): HierarchicalNode {
    // Find all headings with their positions
    const headings: Array<{
      text: string;
      level: number;
      start: number;
      end: number;
    }> = [];

    for (const pattern of this.headingPatterns) {
      const regex = new RegExp(pattern.source, 'gm');
      let match: RegExpExecArray | null = null;
      // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec pattern
      while ((match = regex.exec(document)) !== null) {
        const headingText = match[1]?.trim() || match[0].trim();
        const level = this.estimateHeadingLevel(match[0]);

        headings.push({
          text: headingText,
          level,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Sort by position
    headings.sort((a, b) => a.start - b.start);

    // Remove duplicates (overlapping matches)
    const uniqueHeadings = headings.filter((h, i) => {
      if (i === 0) return true;
      const prev = headings[i - 1];
      return h.start >= prev.end;
    });

    // Build tree structure
    return this.buildTree(document, uniqueHeadings);
  }

  /**
   * Estimate heading level based on pattern
   */
  private estimateHeadingLevel(headingText: string): number {
    // Markdown heading level
    const markdownMatch = headingText.match(/^(#{1,6})\s/);
    if (markdownMatch) {
      return markdownMatch[1].length;
    }

    // Underlined heading
    if (/^=+$/.test(headingText)) {
      return 1;
    }

    // Numbered section (e.g., 1., 1.1, 1.1.1)
    const numberedMatch = headingText.match(/^(\d+\.?)+/);
    if (numberedMatch) {
      return numberedMatch[0].split('.').filter(Boolean).length;
    }

    // Roman numerals
    if (/^[IVX]+\./.test(headingText)) {
      return 1;
    }

    // ALL CAPS - likely top level
    if (/^[A-Z][A-Z\s]{3,}$/.test(headingText)) {
      return 1;
    }

    return 2; // Default
  }

  /**
   * Build tree structure from headings
   */
  private buildTree(
    document: string,
    headings: Array<{ text: string; level: number; start: number; end: number }>
  ): HierarchicalNode {
    const root: HierarchicalNode = {
      id: 'root',
      content: document,
      level: 0,
      start: 0,
      end: document.length,
      children: [],
    };

    if (headings.length === 0) {
      // No headings found, treat entire document as single section
      return root;
    }

    const stack: HierarchicalNode[] = [root];

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const nextHeading = headings[i + 1];
      const sectionEnd = nextHeading ? nextHeading.start : document.length;

      const node: HierarchicalNode = {
        id: generateId(),
        content: document.slice(heading.end, sectionEnd).trim(),
        level: heading.level,
        start: heading.start,
        end: sectionEnd,
        heading: heading.text,
        children: [],
      };

      // Find parent
      while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      parent.children.push(node);
      node.parent = parent;

      stack.push(node);
    }

    return root;
  }

  /**
   * Create flat structure when no headings are found
   */
  private createFlatStructure(document: string): HierarchicalNode {
    return {
      id: 'root',
      content: document,
      level: 0,
      start: 0,
      end: document.length,
      children: [],
    };
  }

  /**
   * Build chunks from hierarchical node
   */
  private async buildChunksFromNode(
    node: HierarchicalNode,
    originalDocument: string,
    documentId: string | undefined,
    maxLevels: number,
    currentLevel: number,
    chunks: Chunk[]
  ): Promise<void> {
    // Create chunk for this node if it's not the root
    if (node.id !== 'root') {
      const chunk: Chunk = {
        id: node.id,
        content: node.content,
        metadata: {
          index: chunks.length,
          start: node.start,
          end: node.end,
          tokenCount: estimateTokenCount(node.content),
          headings: this.getHeadingPath(node),
          level: currentLevel,
          parentId: node.parent?.id !== 'root' ? node.parent?.id : undefined,
        },
      };
      chunks.push(chunk);
    }

    // Process children if we haven't reached max depth
    if (currentLevel < maxLevels - 1) {
      for (const child of node.children) {
        await this.buildChunksFromNode(
          child,
          originalDocument,
          documentId,
          maxLevels,
          currentLevel + 1,
          chunks
        );
      }
    } else if (node.children.length > 0) {
      // Flatten remaining children into paragraphs
      const childChunks = await this.createChildChunks(node, originalDocument, chunks.length);
      chunks.push(...childChunks);
    }

    // If node has no children but has content, split it further
    if (
      node.children.length === 0 &&
      node.content.length > (options?.chunkSize ?? 1000) &&
      currentLevel < maxLevels
    ) {
      const subChunks = await this.splitIntoSubChunks(
        node,
        originalDocument,
        chunks.length,
        currentLevel
      );
      chunks.push(...subChunks);
    }
  }

  /**
   * Get heading path from root to this node
   */
  private getHeadingPath(node: HierarchicalNode): string[] {
    const path: string[] = [];
    let current: HierarchicalNode | undefined = node;

    while (current && current.id !== 'root') {
      if (current.heading) {
        path.unshift(current.heading);
      }
      current = current.parent;
    }

    return path;
  }

  /**
   * Create child chunks from paragraphs
   */
  private async createChildChunks(
    parentNode: HierarchicalNode,
    _originalDocument: string,
    startIndex: number
  ): Promise<Chunk[]> {
    const chunks: Chunk[] = [];

    for (let i = 0; i < parentNode.children.length; i++) {
      const child = parentNode.children[i];
      const chunk: Chunk = {
        id: child.id,
        content: child.content,
        metadata: {
          index: startIndex + i,
          start: child.start,
          end: child.end,
          tokenCount: estimateTokenCount(child.content),
          headings: this.getHeadingPath(child),
          level: parentNode.level + 1,
          parentId: parentNode.id,
        },
      };
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Split node content into sub-chunks
   */
  private async splitIntoSubChunks(
    node: HierarchicalNode,
    _originalDocument: string,
    startIndex: number,
    level: number
  ): Promise<Chunk[]> {
    const chunks: Chunk[] = [];

    // Use fixed chunker for splitting
    const subChunks = await this.fixedChunker.chunk(node.content, {
      strategy: 'fixed',
      chunkSize: 800,
      chunkOverlap: 150,
    });

    for (let i = 0; i < subChunks.length; i++) {
      const subChunk = subChunks[i];
      const chunk: Chunk = {
        id: generateId(),
        content: subChunk.content,
        metadata: {
          index: startIndex + i,
          start: node.start + subChunk.metadata.start,
          end: node.start + subChunk.metadata.end,
          tokenCount: subChunk.metadata.tokenCount,
          headings: this.getHeadingPath(node),
          level: level + 1,
          parentId: node.id,
        },
      };
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Flatten hierarchy and establish parent-child relationships
   */
  private flattenHierarchy(chunks: Chunk[]): Chunk[] {
    // Build parent-child relationships
    const chunkMap = new Map<string, Chunk>();

    for (const chunk of chunks) {
      chunkMap.set(chunk.id, chunk);
    }

    // Add childIds to parents
    for (const chunk of chunks) {
      if (chunk.metadata.parentId) {
        const parent = chunkMap.get(chunk.metadata.parentId);
        if (parent) {
          if (!parent.metadata.childIds) {
            parent.metadata.childIds = [];
          }
          parent.metadata.childIds.push(chunk.id);
        }
      }
    }

    // Re-index chunks
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        index,
      },
    }));
  }
}

// Reference to options for internal use
let options: ChunkingOptions | undefined;

/**
 * Convenience function for hierarchical chunking
 */
export async function chunkHierarchical(
  document: string,
  optionsInput: Omit<ChunkingOptions, 'strategy'> & {
    hierarchicalLevels?: number;
    parseHeadings?: boolean;
  }
): Promise<Chunk[]> {
  const chunker = new HierarchicalChunker();

  return chunker.chunk(document, {
    ...optionsInput,
    strategy: 'hierarchical',
    hierarchicalLevels: optionsInput.hierarchicalLevels ?? 2,
    parseHeadings: optionsInput.parseHeadings,
  });
}

/**
 * Get parent chunk for a given child chunk
 */
export function getParentChunk(childChunk: Chunk, allChunks: Chunk[]): Chunk | undefined {
  if (!childChunk.metadata.parentId) {
    return undefined;
  }
  return allChunks.find((c) => c.id === childChunk.metadata.parentId);
}

/**
 * Get all child chunks for a given parent chunk
 */
export function getChildChunks(parentChunk: Chunk, allChunks: Chunk[]): Chunk[] {
  if (!parentChunk.metadata.childIds || parentChunk.metadata.childIds.length === 0) {
    return [];
  }
  return allChunks.filter((c) => parentChunk.metadata.childIds?.includes(c.id));
}

/**
 * Get full context path for a chunk (all ancestors)
 */
export function getChunkContextPath(chunk: Chunk, allChunks: Chunk[]): Chunk[] {
  const path: Chunk[] = [];
  let current: Chunk | undefined = chunk;

  while (current?.metadata.parentId) {
    const parent = allChunks.find((c) => c.id === current?.metadata.parentId);
    if (parent) {
      path.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }

  return path;
}

/**
 * Build enriched context for a chunk by combining with parent context
 */
export function buildEnrichedContext(
  chunk: Chunk,
  allChunks: Chunk[],
  options?: {
    includeParentContent?: boolean;
    maxParentContentLength?: number;
  }
): string {
  const ancestors = getChunkContextPath(chunk, allChunks);

  if (!options?.includeParentContent || ancestors.length === 0) {
    // Just return heading context
    if (chunk.metadata.headings && chunk.metadata.headings.length > 0) {
      return `Context: ${chunk.metadata.headings.join(' > ')}\n\n${chunk.content}`;
    }
    return chunk.content;
  }

  // Include parent content
  const parentContent = ancestors
    .map((a) => a.content)
    .join('\n\n')
    .slice(0, options.maxParentContentLength ?? 500);

  const headingContext = chunk.metadata.headings
    ? `Context: ${chunk.metadata.headings.join(' > ')}\n\n`
    : '';

  return `${headingContext}Parent Context:\n${parentContent}\n\nContent:\n${chunk.content}`;
}
