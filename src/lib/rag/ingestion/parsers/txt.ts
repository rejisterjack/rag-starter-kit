/**
 * Plain Text Parser with encoding detection
 * Handles large files with streaming and line number mapping
 */

import { Readable } from 'stream';

export interface TextLine {
  lineNumber: number;
  text: string;
  characterCount: number;
}

export interface TextBlock {
  startLine: number;
  endLine: number;
  text: string;
}

export interface ParsedText {
  text: string;
  lines: TextLine[];
  encoding: string;
  lineCount: number;
  characterCount: number;
  wordCount: number;
}

export interface TextParseOptions {
  encoding?: string;
  detectEncoding?: boolean;
  maxFileSize?: number; // in bytes
  chunkSize?: number;   // for streaming large files
}

// Common encodings to try
const COMMON_ENCODINGS = ['utf-8', 'utf-16le', 'utf-16be', 'latin1', 'ascii', 'windows-1252'];

/**
 * Parse a text buffer with encoding detection
 */
export function parseText(buffer: Buffer, options: TextParseOptions = {}): ParsedText {
  const maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB default

  if (buffer.length > maxFileSize) {
    throw new TextParserError(
      `File size (${formatBytes(buffer.length)}) exceeds maximum allowed (${formatBytes(maxFileSize)})`
    );
  }

  // Detect or use specified encoding
  let encoding = options.encoding || 'utf-8';
  
  if (options.detectEncoding !== false) {
    encoding = detectEncoding(buffer);
  }

  // Convert buffer to string
  let text: string;
  try {
    text = buffer.toString(encoding as BufferEncoding);
  } catch (error) {
    // Fallback to utf-8 with replacement characters
    text = buffer.toString('utf-8');
  }

  // Normalize line endings
  text = normalizeLineEndings(text);

  // Parse lines
  const lines = parseLines(text);

  // Calculate statistics
  const lineCount = lines.length;
  const characterCount = text.length;
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;

  return {
    text,
    lines,
    encoding,
    lineCount,
    characterCount,
    wordCount,
  };
}

/**
 * Detect text encoding from buffer
 */
function detectEncoding(buffer: Buffer): string {
  // Check for BOM (Byte Order Mark)
  if (buffer.length >= 3) {
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf-8'; // UTF-8 BOM
    }
  }
  
  if (buffer.length >= 2) {
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'utf-16le'; // UTF-16 LE BOM
    }
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'utf-16be'; // UTF-16 BE BOM
    }
  }

  // Try to detect by analyzing byte patterns
  // Check for valid UTF-8 sequences
  let isValidUtf8 = true;
  let i = 0;
  
  while (i < Math.min(buffer.length, 4096)) {
    const byte = buffer[i];
    
    // Check for null bytes (likely binary or UTF-16)
    if (byte === 0) {
      isValidUtf8 = false;
      break;
    }
    
    // Check for multi-byte UTF-8 sequences
    if (byte >= 0x80) {
      let bytesToFollow = 0;
      if ((byte & 0xE0) === 0xC0) bytesToFollow = 1;
      else if ((byte & 0xF0) === 0xE0) bytesToFollow = 2;
      else if ((byte & 0xF8) === 0xF0) bytesToFollow = 3;
      
      for (let j = 1; j <= bytesToFollow; j++) {
        if (i + j >= buffer.length || (buffer[i + j] & 0xC0) !== 0x80) {
          isValidUtf8 = false;
          break;
        }
      }
      i += bytesToFollow;
    }
    i++;
  }

  if (isValidUtf8) {
    return 'utf-8';
  }

  // Default to latin1 for non-UTF-8 binary-looking data
  return 'latin1';
}

/**
 * Normalize line endings to \n
 */
function normalizeLineEndings(text: string): string {
  return text
    .replace(/\r\n/g, '\n')  // Windows CRLF
    .replace(/\r/g, '\n');   // Old Mac CR
}

/**
 * Parse text into lines with metadata
 */
function parseLines(text: string): TextLine[] {
  const rawLines = text.split('\n');
  
  return rawLines.map((line, index) => ({
    lineNumber: index + 1,
    text: line,
    characterCount: line.length,
  }));
}

/**
 * Parse large text files using streaming
 */
export async function* parseTextStream(
  buffer: Buffer,
  options: TextParseOptions = {}
): AsyncGenerator<TextBlock, void, unknown> {
  const chunkSize = options.chunkSize || 64 * 1024; // 64KB chunks
  const encoding = options.encoding || detectEncoding(buffer);
  
  let offset = 0;
  let lineNumber = 1;
  let pendingLine = '';

  while (offset < buffer.length) {
    const end = Math.min(offset + chunkSize, buffer.length);
    const chunk = buffer.slice(offset, end);
    
    let text: string;
    try {
      text = chunk.toString(encoding as BufferEncoding);
    } catch {
      text = chunk.toString('utf-8');
    }

    // Handle line splits across chunks
    const combined = pendingLine + text;
    const lines = combined.split('\n');
    
    // Keep the last potentially incomplete line for next chunk
    pendingLine = lines.pop() || '';

    // Yield complete lines
    for (const line of lines) {
      yield {
        startLine: lineNumber,
        endLine: lineNumber,
        text: line,
      };
      lineNumber++;
    }

    offset = end;
  }

  // Yield any remaining content
  if (pendingLine.length > 0) {
    yield {
      startLine: lineNumber,
      endLine: lineNumber,
      text: pendingLine,
    };
  }
}

/**
 * Extract text block by line range
 */
export function extractByLineRange(parsed: ParsedText, startLine: number, endLine: number): string {
  const startIndex = Math.max(0, startLine - 1);
  const endIndex = Math.min(parsed.lines.length, endLine);
  
  return parsed.lines
    .slice(startIndex, endIndex)
    .map(l => l.text)
    .join('\n');
}

/**
 * Search for text and return line numbers
 */
export function searchInText(parsed: ParsedText, query: string): Array<{ lineNumber: number; text: string }> {
  const lowerQuery = query.toLowerCase();
  
  return parsed.lines
    .filter(line => line.text.toLowerCase().includes(lowerQuery))
    .map(line => ({
      lineNumber: line.lineNumber,
      text: line.text,
    }));
}

/**
 * Extract code blocks (indented or fenced)
 */
export function extractCodeBlocks(text: string): Array<{ language?: string; code: string; startLine: number }> {
  const blocks: Array<{ language?: string; code: string; startLine: number }> = [];
  const lines = text.split('\n');
  
  let inFencedBlock = false;
  let currentBlock: string[] = [];
  let currentLanguage: string | undefined;
  let blockStartLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(\w*)/);
    
    if (fenceMatch) {
      if (!inFencedBlock) {
        // Start of fenced block
        inFencedBlock = true;
        currentLanguage = fenceMatch[1] || undefined;
        currentBlock = [];
        blockStartLine = i + 1;
      } else {
        // End of fenced block
        inFencedBlock = false;
        blocks.push({
          language: currentLanguage,
          code: currentBlock.join('\n'),
          startLine: blockStartLine,
        });
        currentBlock = [];
      }
    } else if (inFencedBlock) {
      currentBlock.push(line);
    }
  }
  
  return blocks;
}

/**
 * Extract headings from markdown-formatted text
 */
export function extractMarkdownHeadings(text: string): Array<{ level: number; text: string; lineNumber: number }> {
  const headings: Array<{ level: number; text: string; lineNumber: number }> = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // ATX style headings (# Heading)
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      headings.push({
        level: atxMatch[1].length,
        text: atxMatch[2].trim(),
        lineNumber: i + 1,
      });
      continue;
    }
    
    // Setext style headings (underlined)
    if (i < lines.length - 1) {
      const nextLine = lines[i + 1];
      if (/^=+$/.test(nextLine)) {
        headings.push({
          level: 1,
          text: line.trim(),
          lineNumber: i + 1,
        });
      } else if (/^-+$/.test(nextLine)) {
        headings.push({
          level: 2,
          text: line.trim(),
          lineNumber: i + 1,
        });
      }
    }
  }
  
  return headings;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Custom error class for text parser
 */
export class TextParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TextParserError';
  }
}
