/**
 * Source Citations
 * Handles citation formatting, extraction, and highlighting for RAG responses
 */

// Local Source type definition to avoid circular dependency
interface Source {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    documentName: string;
    page?: number;
    chunkIndex: number;
    totalChunks: number;
  };
  similarity?: number;
}

// =============================================================================
// Types
// =============================================================================

export interface Citation {
  id: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  content: string;
  score: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  page?: number;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface HighlightedSource {
  originalContent: string;
  highlightedContent: string;
  citationIds: string[];
}

export interface CitationMatch {
  citationId: string;
  startIndex: number;
  endIndex: number;
  matchedText: string;
}

// =============================================================================
// Citation Handler
// =============================================================================

export class CitationHandler {
  private citationCounter = 0;

  /**
   * Reset the citation counter
   */
  reset(): void {
    this.citationCounter = 0;
  }

  /**
   * Format context with citation markers inserted
   */
  formatContextWithCitations(chunks: RetrievedChunk[]): {
    context: string;
    citationMap: Map<string, Citation>;
  } {
    this.reset();
    const citationMap = new Map<string, Citation>();
    const contextParts: string[] = [];

    for (const chunk of chunks) {
      this.citationCounter++;
      const citationId = `[${this.citationCounter}]`;

      const citation: Citation = {
        id: citationId,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        page: chunk.page,
        content: chunk.content,
        score: chunk.score,
      };

      citationMap.set(citationId, citation);

      const sourceHeader = this.buildSourceHeader(chunk, citationId);
      contextParts.push(`${sourceHeader}\n${chunk.content}`);
    }

    return {
      context: contextParts.join('\n\n'),
      citationMap,
    };
  }

  /**
   * Extract citations from LLM response text
   */
  extractCitations(
    response: string,
    citationMap: Map<string, Citation>
  ): Citation[] {
    const citations: Citation[] = [];
    const seenIds = new Set<string>();

    // Match citation patterns like [1], [2], [1][2], etc.
    const citationPattern = /\[(\d+)\]/g;
    let patternMatch: RegExpExecArray | null;

    while ((patternMatch = citationPattern.exec(response)) !== null) {
      const citationId = `[${patternMatch[1]}]`;
      
      if (!seenIds.has(citationId)) {
        seenIds.add(citationId);
        const citation = citationMap.get(citationId);
        if (citation) {
          citations.push(citation);
        }
      }
    }

    return citations;
  }

  /**
   * Extract citations with position information for highlighting
   */
  extractCitationsWithPositions(response: string): CitationMatch[] {
    const matches: CitationMatch[] = [];
    const citationPattern = /\[(\d+)\]/g;
    let patternMatch: RegExpExecArray | null;

    while ((patternMatch = citationPattern.exec(response)) !== null) {
      matches.push({
        citationId: `[${patternMatch[1]}]`,
        startIndex: patternMatch.index,
        endIndex: patternMatch.index + patternMatch[0].length,
        matchedText: patternMatch[0],
      });
    }

    return matches;
  }

  /**
   * Highlight cited text in original source
   */
  highlightSource(
    chunk: RetrievedChunk,
    citationId: string,
    searchTerm?: string
  ): HighlightedSource {
    let highlightedContent = chunk.content;
    const citationIds: string[] = [citationId];

    if (searchTerm && searchTerm.trim()) {
      // Try to find and highlight the specific portion that was cited
      const term = searchTerm.trim();
      const termIndex = chunk.content.toLowerCase().indexOf(term.toLowerCase());
      
      if (termIndex !== -1) {
        const before = chunk.content.slice(0, termIndex);
        const highlighted = chunk.content.slice(termIndex, termIndex + term.length);
        const after = chunk.content.slice(termIndex + term.length);
        
        highlightedContent = `${before}**${highlighted}**${after}`;
      }
    }

    // Add citation marker at the beginning
    highlightedContent = `${citationId} ${highlightedContent}`;

    return {
      originalContent: chunk.content,
      highlightedContent,
      citationIds,
    };
  }

  /**
   * Build a source list for display
   */
  buildSourceList(citations: Citation[]): string {
    if (citations.length === 0) {
      return '';
    }

    return citations
      .map((c) => {
        const pageInfo = c.page ? `, page ${c.page}` : '';
        return `${c.id} ${c.documentName}${pageInfo} (score: ${(c.score * 100).toFixed(1)}%)`;
      })
      .join('\n');
  }

  /**
   * Format citations as markdown footnotes
   */
  formatAsFootnotes(citations: Citation[]): string {
    if (citations.length === 0) {
      return '';
    }

    const footnotes = citations.map((c) => {
      const pageInfo = c.page ? `, p.${c.page}` : '';
      return `[^${c.id.replace(/[\[\]]/g, '')}]: ${c.documentName}${pageInfo}`;
    });

    return '\n\n' + footnotes.join('\n');
  }

  /**
   * Convert response text with bracket citations to markdown footnotes
   */
  convertToFootnotes(response: string, citations: Citation[]): string {
    let converted = response;
    
    for (const c of citations) {
      const bracketId = c.id;
      const footnoteId = `[^${c.id.replace(/[\[\]]/g, '')}]`;
      converted = converted.replace(new RegExp(`\\${bracketId}`, 'g'), footnoteId);
    }

    return converted + this.formatAsFootnotes(citations);
  }

  /**
   * Validate that all citations in response exist in the citation map
   */
  validateCitations(
    response: string,
    citationMap: Map<string, Citation>
  ): {
    valid: boolean;
    missingCitations: string[];
    usedCitations: Citation[];
  } {
    const usedCitationIds = this.extractCitationsWithPositions(response).map(
      (m) => m.citationId
    );
    
    const missingCitations: string[] = [];
    const usedCitations: Citation[] = [];

    for (const id of usedCitationIds) {
      const citation = citationMap.get(id);
      if (citation) {
        usedCitations.push(citation);
      } else {
        missingCitations.push(id);
      }
    }

    return {
      valid: missingCitations.length === 0,
      missingCitations: Array.from(new Set(missingCitations)),
      usedCitations: Array.from(new Map(usedCitations.map((c) => [c.id, c])).values()),
    };
  }

  /**
   * Group citations by document
   */
  groupByDocument(citations: Citation[]): Map<string, Citation[]> {
    const grouped = new Map<string, Citation[]>();

    for (const citation of citations) {
      const existing = grouped.get(citation.documentId) ?? [];
      existing.push(citation);
      grouped.set(citation.documentId, existing);
    }

    return grouped;
  }

  /**
   * Get unique documents from citations
   */
  getUniqueDocuments(citations: Citation[]): Array<{
    documentId: string;
    documentName: string;
    citations: Citation[];
  }> {
    const grouped = this.groupByDocument(citations);
    
    return Array.from(grouped.entries()).map(([documentId, citationsList]) => ({
      documentId,
      documentName: citationsList[0]?.documentName ?? 'Unknown',
      citations: citationsList,
    }));
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private buildSourceHeader(chunk: RetrievedChunk, citationId: string): string {
    const pageInfo = chunk.page ? ` (Page ${chunk.page})` : '';
    return `${citationId} Source: "${chunk.documentName}"${pageInfo}`;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a citation handler instance
 */
export function createCitationHandler(): CitationHandler {
  return new CitationHandler();
}

/**
 * Convert Sources to RetrievedChunks
 */
export function sourcesToChunks(sources: Source[]): RetrievedChunk[] {
  return sources.map((source) => ({
    id: source.id,
    content: source.content,
    documentId: source.metadata.documentId,
    documentName: source.metadata.documentName,
    page: source.metadata.page,
    score: source.similarity ?? 0,
    metadata: {
      chunkIndex: source.metadata.chunkIndex,
      totalChunks: source.metadata.totalChunks,
    },
  }));
}

/**
 * Extract citation numbers from text
 */
export function extractCitationNumbers(text: string): number[] {
  const numbers: number[] = [];
  const pattern = /\[(\d+)\]/g;
  let patternMatch: RegExpExecArray | null;

  while ((patternMatch = pattern.exec(text)) !== null) {
    numbers.push(parseInt(patternMatch[1], 10));
  }

  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

/**
 * Remove citations from text
 */
export function removeCitations(text: string): string {
  return text.replace(/\s*\[\d+\]\s*/g, ' ').trim();
}

/**
 * Replace citations with links (for UI rendering)
 */
export function replaceCitationsWithLinks(
  text: string,
  getLinkHref: (citationId: string) => string
): string {
  return text.replace(/\[(\d+)\]/g, (match, num) => {
    const href = getLinkHref(num);
    return `[${num}](${href})`;
  });
}

/**
 * Sort citations by relevance score
 */
export function sortCitationsByScore(citations: Citation[]): Citation[] {
  return [...citations].sort((a, b) => b.score - a.score);
}

/**
 * Get the most relevant citation
 */
export function getMostRelevantCitation(citations: Citation[]): Citation | undefined {
  if (citations.length === 0) return undefined;
  return sortCitationsByScore(citations)[0];
}

/**
 * Format citation for display in UI
 */
export function formatCitationForDisplay(
  citation: Citation,
  options: { showScore?: boolean; showContent?: boolean } = {}
): string {
  const { showScore = true, showContent = false } = options;
  
  const parts: string[] = [
    `${citation.id} ${citation.documentName}`,
  ];

  if (citation.page) {
    parts.push(`Page ${citation.page}`);
  }

  if (showScore) {
    parts.push(`(${(citation.score * 100).toFixed(0)}% match)`);
  }

  let result = parts.join(' - ');

  if (showContent && citation.content) {
    const preview = citation.content.slice(0, 150).replace(/\n/g, ' ');
    result += `\n   "${preview}${citation.content.length > 150 ? '...' : ''}"`;
  }

  return result;
}
