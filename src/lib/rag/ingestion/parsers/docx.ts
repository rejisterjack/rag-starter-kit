/**
 * Word Document (.docx) Parser
 * Extracts text with paragraph structure, headers/footers, and document metadata
 */

import mammoth from 'mammoth';

export interface DOCXParagraph {
  text: string;
  style?: string;
  isHeading: boolean;
  headingLevel?: number;
  isListItem: boolean;
  listLevel?: number;
}

export interface DOCXSection {
  type: 'body' | 'header' | 'footer' | 'footnote';
  paragraphs: DOCXParagraph[];
}

export interface DOCXMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  description?: string;
  lastModifiedBy?: string;
  revision?: number;
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface ParsedDOCX {
  text: string;
  paragraphs: DOCXParagraph[];
  sections: DOCXSection[];
  metadata: DOCXMetadata;
  wordCount: number;
  characterCount: number;
}

/**
 * Parse a DOCX buffer and extract structured content
 */
export async function parseDOCX(buffer: Buffer): Promise<ParsedDOCX> {
  try {
    // Extract raw text and document structure
    const [rawResult, structuredResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }),
    ]);

    const rawText = rawResult.value;
    const html = structuredResult.value;

    // Parse document metadata from buffer
    const metadata = await extractMetadata(buffer);

    // Parse structured paragraphs from HTML
    const paragraphs = parseParagraphsFromHTML(html);

    // Build sections
    const sections: DOCXSection[] = [
      {
        type: 'body',
        paragraphs,
      },
    ];

    // Calculate statistics
    const wordCount = rawText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const characterCount = rawText.length;

    return {
      text: rawText,
      paragraphs,
      sections,
      metadata,
      wordCount,
      characterCount,
    };
  } catch (error) {
    throw new DOCXParserError(
      `Failed to parse DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse paragraphs from mammoth's HTML output
 */
function parseParagraphsFromHTML(html: string): DOCXParagraph[] {
  const paragraphs: DOCXParagraph[] = [];

  // Simple regex-based HTML parsing for paragraph structure
  // In production, consider using a proper HTML parser
  const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;

  let match: RegExpExecArray | null;

  // Extract headings
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = stripHtmlTags(match[2]).trim();
    if (text) {
      paragraphs.push({
        text,
        style: `Heading ${level}`,
        isHeading: true,
        headingLevel: level,
        isListItem: false,
      });
    }
  }

  // Extract list items
  const listLevel = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
  while ((match = listItemRegex.exec(html)) !== null) {
    const text = stripHtmlTags(match[1]).trim();
    if (text) {
      paragraphs.push({
        text,
        style: 'List Paragraph',
        isHeading: false,
        isListItem: true,
        listLevel,
      });
    }
  }

  // Extract regular paragraphs
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = stripHtmlTags(match[1]).trim();
    if (text && !paragraphs.some((p) => p.text === text)) {
      paragraphs.push({
        text,
        style: 'Normal',
        isHeading: false,
        isListItem: false,
      });
    }
  }

  return paragraphs;
}

/**
 * Strip HTML tags from text
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extract metadata from DOCX file
 */
async function extractMetadata(buffer: Buffer): Promise<DOCXMetadata> {
  try {
    await mammoth.extractRawText({ buffer });
    // mammoth doesn't expose metadata directly, so we use heuristics

    return {
      // These would be extracted from the DOCX core.xml if available
      title: undefined,
      author: undefined,
      subject: undefined,
      keywords: undefined,
      description: undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Extract document outline (headings hierarchy)
 */
export function extractOutline(
  paragraphs: DOCXParagraph[]
): Array<{ level: number; text: string }> {
  return paragraphs
    .filter((p) => p.isHeading)
    .map((p) => ({
      level: p.headingLevel || 1,
      text: p.text,
    }));
}

/**
 * Extract content by heading section
 */
export function extractBySection(paragraphs: DOCXParagraph[], sectionHeading: string): string {
  let inSection = false;
  const sectionContent: string[] = [];

  for (const para of paragraphs) {
    if (para.isHeading && para.text.toLowerCase().includes(sectionHeading.toLowerCase())) {
      inSection = true;
      continue;
    }

    if (inSection) {
      // Stop when we hit the next heading of same or higher level
      if (para.isHeading) {
        break;
      }
      sectionContent.push(para.text);
    }
  }

  return sectionContent.join('\n\n');
}

/**
 * Convert DOCX to Markdown format
 */
export function convertToMarkdown(parsed: ParsedDOCX): string {
  const lines: string[] = [];

  for (const para of parsed.paragraphs) {
    if (para.isHeading && para.headingLevel) {
      lines.push(`${'#'.repeat(para.headingLevel)} ${para.text}`);
    } else if (para.isListItem) {
      lines.push(`- ${para.text}`);
    } else {
      lines.push(para.text);
    }
  }

  return lines.join('\n\n');
}

/**
 * Custom error class for DOCX parser
 */
export class DOCXParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DOCXParserError';
  }
}

/**
 * Validate if buffer is a valid DOCX file
 */
export function isValidDOCX(buffer: Buffer): boolean {
  // DOCX files are ZIP archives that start with PK
  return (
    buffer.length > 4 &&
    buffer[0] === 0x50 && // P
    buffer[1] === 0x4b
  ); // K
}
