/**
 * Document analysis for smart chunking strategy selection
 */

import type {
  DocumentProfile,
  DocumentType,
  DocumentStructure,
  ChunkingStrategy,
  DocumentAnalyzer as IDocumentAnalyzer,
} from './types';
import { estimateTokenCount } from './tokens';

/**
 * Analyzer for detecting document characteristics and recommending chunking strategies
 */
export class DocumentAnalyzer implements IDocumentAnalyzer {
  // Patterns for different document types
  private readonly codePatterns = {
    languages: /\b(javascript|typescript|python|java|cpp|c\+\+|go|ruby|rust|swift|kotlin|php)\b/gi,
    syntax: /[{};]|function\s+\w+|class\s+\w+|import\s+|const\s+|let\s+|var\s+/g,
    codeBlocks: /```[\s\S]*?```/g,
    indentation: /^(\s{2,}|\t+)/m,
  };

  private readonly legalPatterns = {
    terms: /\b(hereby|pursuant|whereas|notwithstanding|hereinafter|aforementioned)\b/gi,
    sections: /\b(section|article|clause|provision|warranty|liability|indemnification)\b/gi,
    citations: /\b(v\.\s+\d+|et\s+al\.?|ibid\.?|supra|infra)\b/gi,
    definitions: /"[^"]+"\s+means|shall\s+mean/gi,
  };

  private readonly academicPatterns = {
    citations: /\[\d+\]|\(\w+\s+et\s+al\.?,\s*\d{4}\)|doi:|arxiv:/gi,
    sections: /\b(abstract|introduction|methodology|results|discussion|conclusion|references)\b/gi,
    jargon: /\b(hypothesis|methodology|significant|correlation|regression|p-value|et\s+al)\b/gi,
  };

  private readonly headingPatterns = [
    /^#{1,6}\s+.+$/m, // Markdown headings
    /^\d+\.\s+\w+/m, // Numbered sections
    /^[A-Z][A-Z\s]{2,}$/m, // ALL CAPS headings
    /^\d+\.\d+\.?\s+\w+/m, // Numbered subsections
    /^[IVX]+\.\s+\w+/m, // Roman numerals
  ];

  /**
   * Analyze a document and return its profile
   */
  analyze(content: string): DocumentProfile {
    const structure = this.detectStructure(content);
    const type = this.detectDocumentType(content, structure);
    const avgSentenceLength = this.calculateAvgSentenceLength(content);
    const structureScore = this.calculateStructureScore(structure);
    const estimatedTokens = estimateTokenCount(content);
    const contentDensity = estimatedTokens / content.length;

    const recommendedStrategy = this.recommendStrategy(type, structure, content.length);

    return {
      type,
      recommendedStrategy,
      avgSentenceLength,
      structureScore,
      estimatedTokens,
      structure,
      contentDensity,
    };
  }

  /**
   * Detect document structure elements
   */
  private detectStructure(content: string): DocumentStructure {
    const hasHeadings = this.headingPatterns.some((pattern) =>
      pattern.test(content)
    );

    const headingMatches = content.match(/^#{1,6}\s+(.+)$/gm) ||
      content.match(/^[A-Z][A-Z\s]{2,}$/gm) ||
      content.match(/^\d+\.\s+\w+/gm) ||
      [];

    const headings = headingMatches.map((h) => h.replace(/^#+\s*/, '').trim());

    const hasCodeBlocks = /```[\s\S]*?```/.test(content) ||
      /^\s{4,}\w+/m.test(content);

    const hasLists = /^\s*[-*+]\s/m.test(content) ||
      /^\s*\d+\.\s/m.test(content);

    const hasTables = /\|.*\|/.test(content);

    const paragraphs = content
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0);
    const avgParagraphLength = paragraphs.length > 0
      ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length
      : 0;

    return {
      hasHeadings,
      headingCount: headings.length,
      hasCodeBlocks,
      hasLists,
      hasTables,
      avgParagraphLength,
      headings: headings.slice(0, 20), // Limit to first 20
    };
  }

  /**
   * Detect document type based on content patterns
   */
  private detectDocumentType(
    content: string,
    structure: DocumentStructure
  ): DocumentType {
    const scores: Record<DocumentType, number> = {
      code: 0,
      legal: 0,
      academic: 0,
      technical: 0,
      narrative: 0,
      general: 0,
    };

    // Code detection
    const codeMatches =
      (content.match(this.codePatterns.syntax) || []).length +
      (content.match(this.codePatterns.codeBlocks) || []).length * 3 +
      (content.match(this.codePatterns.languages) || []).length;
    scores.code = codeMatches;

    // Legal detection
    const legalMatches =
      (content.match(this.legalPatterns.terms) || []).length +
      (content.match(this.legalPatterns.sections) || []).length +
      (content.match(this.legalPatterns.citations) || []).length * 2;
    scores.legal = legalMatches;

    // Academic detection
    const academicMatches =
      (content.match(this.academicPatterns.citations) || []).length * 2 +
      (content.match(this.academicPatterns.sections) || []).length +
      (content.match(this.academicPatterns.jargon) || []).length;
    scores.academic = academicMatches;

    // Technical detection
    const hasTechnicalMarkers =
      /\b(API|endpoint|function|method|class|interface|component|module|library)\b/i.test(
        content
      );
    const hasCodeExamples = structure.hasCodeBlocks;
    scores.technical = (hasTechnicalMarkers ? 5 : 0) + (hasCodeExamples ? 3 : 0);

    // Narrative detection
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLen = sentences.length > 0
      ? content.length / sentences.length
      : 0;
    const hasDialogue = /"[^"]+"\s*said|\bsaid\s+"[^"]+"/i.test(content);
    const hasNarrativeStructure = avgSentenceLen > 80 && !structure.hasHeadings;
    scores.narrative = (hasDialogue ? 5 : 0) + (hasNarrativeStructure ? 3 : 0);

    // Find the highest scoring type
    let maxType: DocumentType = 'general';
    let maxScore = 0;

    for (const [type, score] of Object.entries(scores) as [DocumentType, number][]) {
      if (score > maxScore && score > 3) {
        maxScore = score;
        maxType = type;
      }
    }

    return maxType;
  }

  /**
   * Calculate average sentence length
   */
  private calculateAvgSentenceLength(content: string): number {
    const sentences = content
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .filter((s) => s.trim().length > 0);

    if (sentences.length === 0) return 0;

    const totalLength = sentences.reduce((sum, s) => sum + s.length, 0);
    return Math.round(totalLength / sentences.length);
  }

  /**
   * Calculate structure score (0-1)
   */
  private calculateStructureScore(structure: DocumentStructure): number {
    let score = 0;

    if (structure.hasHeadings) score += 0.3;
    if (structure.headingCount > 3) score += 0.2;
    if (structure.hasLists) score += 0.2;
    if (structure.hasCodeBlocks) score += 0.15;
    if (structure.hasTables) score += 0.15;

    return Math.min(score, 1);
  }

  /**
   * Recommend optimal chunking strategy
   */
  private recommendStrategy(
    type: DocumentType,
    structure: DocumentStructure,
    contentLength: number
  ): ChunkingStrategy {
    // Small documents: fixed is fine
    if (contentLength < 2000) {
      return 'fixed';
    }

    switch (type) {
      case 'code':
        // Code benefits from semantic chunking to keep functions together
        return 'semantic';

      case 'legal':
        // Legal docs need hierarchical structure for sections/clauses
        return 'hierarchical';

      case 'academic':
        // Academic papers have clear structure
        return structure.hasHeadings ? 'hierarchical' : 'semantic';

      case 'technical':
        // Technical docs with code benefit from semantic chunking
        return structure.hasCodeBlocks ? 'semantic' : 'fixed';

      case 'narrative':
        // Narrative text flows continuously
        return 'semantic';

      default:
        // Default based on structure
        const structureScore = this.calculateStructureScore(structure);
        if (structureScore > 0.6) {
          return 'hierarchical';
        } else if (contentLength > 10000) {
          return 'semantic';
        }
        return 'fixed';
    }
  }

  /**
   * Get recommended chunk size based on document type
   */
  getRecommendedChunkSize(type: DocumentType): number {
    switch (type) {
      case 'code':
        return 800; // Smaller chunks for code
      case 'legal':
        return 1500; // Larger chunks for legal context
      case 'academic':
        return 1200; // Medium-large for academic
      case 'technical':
        return 1000; // Standard technical
      case 'narrative':
        return 1200; // Larger for narrative flow
      default:
        return 1000;
    }
  }

  /**
   * Get recommended overlap based on document type
   */
  getRecommendedOverlap(type: DocumentType): number {
    switch (type) {
      case 'code':
        return 150; // Less overlap for code
      case 'legal':
        return 300; // More overlap for legal context
      case 'academic':
        return 250; // Medium overlap
      case 'technical':
        return 200; // Standard overlap
      case 'narrative':
        return 250; // Medium overlap for narrative flow
      default:
        return 200;
    }
  }

  /**
   * Quick analyze - returns just the recommended strategy
   */
  quickAnalyze(content: string): ChunkingStrategy {
    return this.analyze(content).recommendedStrategy;
  }
}

/**
 * Create a new document analyzer instance
 */
export function createDocumentAnalyzer(): DocumentAnalyzer {
  return new DocumentAnalyzer();
}

/**
 * Analyze multiple documents and return aggregate stats
 */
export function analyzeDocuments(contents: string[]): {
  types: Record<DocumentType, number>;
  recommendedStrategies: Record<ChunkingStrategy, number>;
  avgStructureScore: number;
  totalTokens: number;
} {
  const analyzer = new DocumentAnalyzer();
  const profiles = contents.map((c) => analyzer.analyze(c));

  const typeCounts: Record<DocumentType, number> = {
    code: 0,
    legal: 0,
    academic: 0,
    technical: 0,
    narrative: 0,
    general: 0,
  };

  const strategyCounts: Record<ChunkingStrategy, number> = {
    fixed: 0,
    semantic: 0,
    hierarchical: 0,
    late: 0,
  };

  let totalStructureScore = 0;
  let totalTokens = 0;

  for (const profile of profiles) {
    typeCounts[profile.type]++;
    strategyCounts[profile.recommendedStrategy]++;
    totalStructureScore += profile.structureScore;
    totalTokens += profile.estimatedTokens;
  }

  return {
    types: typeCounts,
    recommendedStrategies: strategyCounts,
    avgStructureScore: totalStructureScore / profiles.length,
    totalTokens,
  };
}
