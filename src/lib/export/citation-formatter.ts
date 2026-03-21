/**
 * Citation Formatter
 * Formats citations in different academic styles (APA, MLA, Chicago, IEEE)
 */

import type { CitationFormatter, CitationStyle, ExportCitation, FormattedCitation } from './types';

// =============================================================================
// Types
// =============================================================================

export type AcademicCitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee' | 'harvard' | 'vancouver';

export interface CitationFormatOptions {
  style: AcademicCitationStyle;
  includeUrl?: boolean;
  includeDoi?: boolean;
  includeAccessDate?: boolean;
}

export interface BibliographyEntry {
  id: string;
  index: number;
  reference: string;
  authors?: string[];
  year?: number;
  title?: string;
}

// =============================================================================
// Citation Formatter Implementations
// =============================================================================

/**
 * APA (7th edition) Citation Formatter
 */
export class APACitationFormatter implements CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation {
    const inline = `(${citation.documentName}, ${new Date().getFullYear()})`;
    const reference = this.formatReference(citation, index);

    return {
      id: citation.id,
      inline: `[${index + 1}]`,
      reference,
      footnote: inline,
    };
  }

  formatReferenceList(citations: ExportCitation[]): string[] {
    return citations.map((citation, index) => this.formatReference(citation, index));
  }

  private formatReference(citation: ExportCitation, index: number): string {
    const year = new Date().getFullYear();
    const pageInfo = citation.page ? `, p. ${citation.page}` : '';
    return `${index + 1}. ${citation.documentName} (${year})${pageInfo}. Retrieved from RAG Knowledge Base.`;
  }
}

/**
 * MLA (9th edition) Citation Formatter
 */
export class MLACitationFormatter implements CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation {
    const inline = `(${citation.documentName})`;
    const reference = this.formatReference(citation, index);

    return {
      id: citation.id,
      inline: `[${index + 1}]`,
      reference,
      footnote: inline,
    };
  }

  formatReferenceList(citations: ExportCitation[]): string[] {
    return citations.map((citation, index) => this.formatReference(citation, index));
  }

  private formatReference(citation: ExportCitation, index: number): string {
    const pageInfo = citation.page ? `${citation.page}` : 'n. pag.';
    return `${index + 1}. "${citation.documentName}." RAG Knowledge Base, ${new Date().getFullYear()}, p. ${pageInfo}.`;
  }
}

/**
 * Chicago (17th edition) Citation Formatter - Notes-Bibliography style
 */
export class ChicagoCitationFormatter implements CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation {
    const footnoteNum = index + 1;
    const footnoteText = this.formatFootnote(citation);

    return {
      id: citation.id,
      inline: `[${footnoteNum}]`,
      reference: this.formatBibliographyEntry(citation, index),
      footnote: footnoteText,
    };
  }

  formatReferenceList(citations: ExportCitation[]): string[] {
    return citations.map((citation, index) => this.formatBibliographyEntry(citation, index));
  }

  private formatFootnote(citation: ExportCitation): string {
    const pageInfo = citation.page ? `, ${citation.page}` : '';
    return `${citation.documentName}${pageInfo}.`;
  }

  private formatBibliographyEntry(citation: ExportCitation, index: number): string {
    const pageInfo = citation.page ? `, ${citation.page}` : '';
    return `${index + 1}. ${citation.documentName}. RAG Knowledge Base${pageInfo}, ${new Date().getFullYear()}.`;
  }
}

/**
 * IEEE Citation Formatter
 */
export class IEEECitationFormatter implements CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation {
    const bracketedIndex = `[${index + 1}]`;

    return {
      id: citation.id,
      inline: bracketedIndex,
      reference: this.formatReference(citation, index),
      footnote: bracketedIndex,
    };
  }

  formatReferenceList(citations: ExportCitation[]): string[] {
    return citations.map((citation, index) => this.formatReference(citation, index));
  }

  private formatReference(citation: ExportCitation, index: number): string {
    const pageInfo = citation.page ? `, p. ${citation.page}` : '';
    return `[${index + 1}] ${citation.documentName}${pageInfo}.`;
  }
}

/**
 * Harvard Citation Formatter
 */
export class HarvardCitationFormatter implements CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation {
    const year = new Date().getFullYear();
    const inline = `(${citation.documentName}, ${year})`;

    return {
      id: citation.id,
      inline: `[${index + 1}]`,
      reference: this.formatReference(citation, index),
      footnote: inline,
    };
  }

  formatReferenceList(citations: ExportCitation[]): string[] {
    return citations.map((citation, index) => this.formatReference(citation, index));
  }

  private formatReference(citation: ExportCitation, index: number): string {
    const year = new Date().getFullYear();
    const pageInfo = citation.page ? `, p. ${citation.page}` : '';
    return `${index + 1}. ${citation.documentName} (${year})${pageInfo}.`;
  }
}

/**
 * Vancouver Citation Formatter (Medical/Scientific)
 */
export class VancouverCitationFormatter implements CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation {
    const superscript = this.toSuperscript(index + 1);

    return {
      id: citation.id,
      inline: superscript,
      reference: this.formatReference(citation, index),
      footnote: superscript,
    };
  }

  formatReferenceList(citations: ExportCitation[]): string[] {
    return citations.map((citation, index) => this.formatReference(citation, index));
  }

  private formatReference(citation: ExportCitation, index: number): string {
    const pageInfo = citation.page ? `:${citation.page}` : '';
    return `${index + 1}. ${citation.documentName}. RAG Knowledge Base. ${new Date().getFullYear()}${pageInfo}.`;
  }

  private toSuperscript(num: number): string {
    const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    return num
      .toString()
      .split('')
      .map((digit) => superscripts[parseInt(digit, 10)])
      .join('');
  }
}

/**
 * Inline Numbered Citation Formatter (Default)
 */
export class InlineNumberedFormatter implements CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation {
    return {
      id: citation.id,
      inline: `[${index + 1}]`,
      reference: `[${index + 1}] ${citation.documentName}${citation.page ? `, Page ${citation.page}` : ''}`,
      footnote: `[${index + 1}]`,
    };
  }

  formatReferenceList(citations: ExportCitation[]): string[] {
    return citations.map((citation, index) => {
      const pageInfo = citation.page ? `, Page ${citation.page}` : '';
      return `[${index + 1}] ${citation.documentName}${pageInfo}`;
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Get the appropriate citation formatter for a style
 */
export function getCitationFormatter(
  style: CitationStyle | AcademicCitationStyle
): CitationFormatter {
  switch (style) {
    case 'apa':
      return new APACitationFormatter();
    case 'mla':
      return new MLACitationFormatter();
    case 'chicago':
      return new ChicagoCitationFormatter();
    case 'ieee':
      return new IEEECitationFormatter();
    case 'harvard':
      return new HarvardCitationFormatter();
    case 'vancouver':
      return new VancouverCitationFormatter();
    default:
      return new InlineNumberedFormatter();
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Format a single citation
 */
export function formatCitation(
  citation: ExportCitation,
  index: number,
  style: CitationStyle | AcademicCitationStyle = 'inline-numbered'
): FormattedCitation {
  const formatter = getCitationFormatter(style);
  return formatter.format(citation, index);
}

/**
 * Format a list of citations as a bibliography/reference list
 */
export function formatReferenceList(
  citations: ExportCitation[],
  style: CitationStyle | AcademicCitationStyle = 'inline-numbered'
): string[] {
  const formatter = getCitationFormatter(style);
  return formatter.formatReferenceList(citations);
}

/**
 * Format citations for inline use within text
 */
export function formatInlineCitations(
  citations: ExportCitation[],
  style: CitationStyle | AcademicCitationStyle = 'inline-numbered'
): string[] {
  const formatter = getCitationFormatter(style);
  return citations.map((citation, index) => formatter.format(citation, index).inline);
}

/**
 * Format citations as footnotes
 */
export function formatFootnotes(
  citations: ExportCitation[],
  style: CitationStyle | AcademicCitationStyle = 'footnotes'
): Array<{ number: number; text: string }> {
  const formatter = getCitationFormatter(style);
  return citations.map((citation, index) => {
    const formatted = formatter.format(citation, index);
    return {
      number: index + 1,
      text: formatted.footnote || formatted.reference,
    };
  });
}

/**
 * Generate a complete bibliography section
 */
export function generateBibliography(
  citations: ExportCitation[],
  style: CitationStyle | AcademicCitationStyle = 'inline-numbered',
  options?: {
    title?: string;
    includeHeading?: boolean;
  }
): string {
  const references = formatReferenceList(citations, style);
  const title = options?.title || getBibliographyTitle(style);

  let output = '';
  if (options?.includeHeading !== false) {
    output += `# ${title}\n\n`;
  }

  output += references.join('\n\n');
  return output;
}

/**
 * Get the appropriate bibliography title for a style
 */
export function getBibliographyTitle(style: CitationStyle | AcademicCitationStyle): string {
  switch (style) {
    case 'apa':
      return 'References';
    case 'mla':
      return 'Works Cited';
    case 'chicago':
      return 'Bibliography';
    case 'ieee':
    case 'vancouver':
      return 'References';
    case 'harvard':
      return 'Reference List';
    case 'footnotes':
    case 'endnotes':
      return 'Notes';
    default:
      return 'References';
  }
}

/**
 * Sort citations alphabetically by document name
 */
export function sortCitationsAlphabetically(citations: ExportCitation[]): ExportCitation[] {
  return [...citations].sort((a, b) => {
    const nameA = a.documentName.toLowerCase();
    const nameB = b.documentName.toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Remove duplicate citations based on document ID and page
 */
export function deduplicateCitations(citations: ExportCitation[]): ExportCitation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.documentId}-${citation.page ?? 'nopage'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Process citations: deduplicate, sort, and re-index
 */
export function processCitations(
  citations: ExportCitation[],
  options?: {
    deduplicate?: boolean;
    sortAlphabetically?: boolean;
  }
): ExportCitation[] {
  let processed = [...citations];

  if (options?.deduplicate !== false) {
    processed = deduplicateCitations(processed);
  }

  if (options?.sortAlphabetically) {
    processed = sortCitationsAlphabetically(processed);
  }

  // Re-index citations
  return processed.map((citation, index) => ({
    ...citation,
    id: `[${index + 1}]`,
  }));
}

// =============================================================================
// Error Class
// =============================================================================

export class CitationFormatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CitationFormatterError';
  }
}

// =============================================================================
// Export all formatters
// =============================================================================

export const CitationFormatters = {
  APA: APACitationFormatter,
  MLA: MLACitationFormatter,
  Chicago: ChicagoCitationFormatter,
  IEEE: IEEECitationFormatter,
  Harvard: HarvardCitationFormatter,
  Vancouver: VancouverCitationFormatter,
  InlineNumbered: InlineNumberedFormatter,
};

export default {
  getCitationFormatter,
  formatCitation,
  formatReferenceList,
  formatInlineCitations,
  formatFootnotes,
  generateBibliography,
  getBibliographyTitle,
  sortCitationsAlphabetically,
  deduplicateCitations,
  processCitations,
  CitationFormatters,
};
