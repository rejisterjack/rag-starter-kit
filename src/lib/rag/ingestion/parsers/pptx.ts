/**
 * PowerPoint Presentation (.pptx) Parser
 * Extracts text content from slides with structure and metadata
 */

import { unzipSync, strFromU8 } from 'fflate';

export interface PPTXTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
}

export interface PPTXParagraph {
  text: string;
  runs: PPTXTextRun[];
  level?: number; // Indentation level
}

export interface PPTXShape {
  id: string;
  type: 'title' | 'body' | 'text' | 'image' | 'chart' | 'table' | 'other';
  paragraphs: PPTXParagraph[];
}

export interface PPTXSlide {
  number: number;
  slideId: string;
  layout?: string;
  title?: string;
  shapes: PPTXShape[];
  notes?: string;
  text: string; // Concatenated text
}

export interface PPTXMetadata {
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string;
  description?: string;
  lastModifiedBy?: string;
  revision?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  application?: string;
  company?: string;
  category?: string;
  slideCount?: number;
}

export interface ParsedPPTX {
  text: string;
  slides: PPTXSlide[];
  metadata: PPTXMetadata;
  slideCount: number;
  wordCount: number;
}

/**
 * Parse a PPTX buffer and extract structured content
 */
export async function parsePPTX(buffer: Buffer): Promise<ParsedPPTX> {
  try {
    // Unzip the PPTX file (it's a ZIP archive)
    const zipData = unzipSync(new Uint8Array(buffer));
    
    // Parse presentation structure
    const presentationInfo = parsePresentation(zipData);
    
    // Parse slide layouts for text placeholders
    const _layouts = parseSlideLayouts(zipData);
    
    // Parse metadata
    const metadata = parseMetadata(zipData);
    metadata.slideCount = presentationInfo.slideIds.length;
    
    // Parse each slide
    const slides: PPTXSlide[] = [];
    let totalWordCount = 0;
    
    for (let i = 0; i < presentationInfo.slideIds.length; i++) {
      const slideId = presentationInfo.slideIds[i];
      const slidePath = `ppt/slides/slide${i + 1}.xml`;
      const slideData = zipData[slidePath];
      
      if (slideData) {
        const slide = parseSlide(strFromU8(slideData), i + 1, slideId, _layouts);
        slides.push(slide);
        
        // Count words
        const words = slide.text.trim().split(/\s+/).filter(w => w.length > 0);
        totalWordCount += words.length;
      }
    }
    
    // Generate plain text representation
    const text = generateText(slides, metadata);
    
    return {
      text,
      slides,
      metadata,
      slideCount: slides.length,
      wordCount: totalWordCount,
    };
  } catch (error) {
    throw new PPTXParserError(
      `Failed to parse PPTX file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse presentation.xml to get slide order
 */
function parsePresentation(zipData: Record<string, Uint8Array>): { slideIds: string[] } {
  const presentationPath = 'ppt/presentation.xml';
  const data = zipData[presentationPath];
  
  const slideIds: string[] = [];
  
  if (!data) return { slideIds };
  
  const xml = strFromU8(data);
  
  // Parse sldId elements to get slide order
  const sldIdRegex = /<p:sldId\s+[^>]*id="(\d+)"/g;
  let match;
  
  while ((match = sldIdRegex.exec(xml)) !== null) {
    slideIds.push(match[1]);
  }
  
  return { slideIds };
}

/**
 * Parse slide layouts
 */
function parseSlideLayouts(zipData: Record<string, Uint8Array>): Map<string, Map<string, string>> {
  const layouts = new Map<string, Map<string, string>>();
  
  // Parse slideLayout files
  for (const [path, data] of Object.entries(zipData)) {
    if (path.startsWith('ppt/slideLayouts/slideLayout') && path.endsWith('.xml')) {
      const xml = strFromU8(data);
      const placeholders = new Map<string, string>();
      
      // Parse placeholders in layout
      const placeholderRegex = /<p:ph\s+[^>]*type="([^"]+)"[^>]*>/g;
      let match;
      
      while ((match = placeholderRegex.exec(xml)) !== null) {
        const type = match[1];
        // Map placeholder types to expected content types
        placeholders.set(type, type);
      }
      
      layouts.set(path, placeholders);
    }
  }
  
  return layouts;
}

/**
 * Parse a single slide XML
 */
function parseSlide(
  xml: string,
  number: number,
  slideId: string,
  _layouts?: Map<string, Map<string, string>>
): PPTXSlide {
  const shapes: PPTXShape[] = [];
  let title: string | undefined;
  
  // Parse sp (shape) elements
  const spRegex = /<p:sp>(.*?)<\/p:sp>/gs;
  let match;
  
  while ((match = spRegex.exec(xml)) !== null) {
    const spXml = match[1];
    const shape = parseShape(spXml);
    
    if (shape.paragraphs.length > 0) {
      shapes.push(shape);
      
      // Extract title from first title shape
      if (shape.type === 'title' && !title) {
        title = shape.paragraphs.map(p => p.text).join(' ').trim();
      }
    }
  }
  
  // Concatenate all text
  const text = shapes
    .map(s => s.paragraphs.map(p => p.text).join('\n'))
    .join('\n\n');
  
  return {
    number,
    slideId,
    title,
    shapes,
    text,
  };
}

/**
 * Parse a shape element
 */
function parseShape(spXml: string): PPTXShape {
  let shapeType: PPTXShape['type'] = 'other';
  const paragraphs: PPTXParagraph[] = [];
  
  // Determine shape type from placeholder
  const phMatch = spXml.match(/<p:ph\s+[^>]*type="([^"]+)"/);
  if (phMatch) {
    const phType = phMatch[1].toLowerCase();
    if (phType === 'title' || phType === 'ctrTitle') {
      shapeType = 'title';
    } else if (phType === 'body' || phType === 'obj') {
      shapeType = 'body';
    } else if (phType === 'pic') {
      shapeType = 'image';
    } else if (phType === 'chart') {
      shapeType = 'chart';
    } else if (phType === 'tbl') {
      shapeType = 'table';
    } else {
      shapeType = 'text';
    }
  } else {
    // Check if it has text body
    if (spXml.includes('<p:txBody>')) {
      shapeType = 'text';
    }
  }
  
  // Parse txBody (text body) if present
  const txBodyMatch = spXml.match(/<p:txBody>(.*?)<\/p:txBody>/s);
  if (txBodyMatch) {
    const txBody = txBodyMatch[1];
    
    // Parse paragraph elements
    const pRegex = /<a:p(?:\s+[^>]*)?>(.*?)<\/a:p>/gs;
    let pMatch;
    
    while ((pMatch = pRegex.exec(txBody)) !== null) {
      const paragraph = parseParagraph(pMatch[1]);
      if (paragraph.text.length > 0) {
        paragraphs.push(paragraph);
      }
    }
  }
  
  // Parse shape ID
  const idMatch = spXml.match(/<p:cNvPr[^>]*id="(\d+)"/);
  const id = idMatch ? idMatch[1] : Math.random().toString(36);
  
  return {
    id,
    type: shapeType,
    paragraphs,
  };
}

/**
 * Parse a paragraph element
 */
function parseParagraph(pXml: string): PPTXParagraph {
  const runs: PPTXTextRun[] = [];
  
  // Parse text runs (r elements)
  const rRegex = /<a:r(?:\s+[^>]*)?>(.*?)<\/a:r>/gs;
  let match;
  
  while ((match = rRegex.exec(pXml)) !== null) {
    const run = parseTextRun(match[1]);
    if (run.text.length > 0) {
      runs.push(run);
    }
  }
  
  // Also handle line breaks
  const brRegex = /<a:br\s*\/?>/g;
  while ((match = brRegex.exec(pXml)) !== null) {
    if (runs.length > 0) {
      runs[runs.length - 1].text += '\n';
    }
  }
  
  // Concatenate all text
  const text = runs.map(r => r.text).join('');
  
  // Parse level (indentation)
  const levelMatch = pXml.match(/lvl="(\d+)"/);
  const level = levelMatch ? parseInt(levelMatch[1], 10) : undefined;
  
  return {
    text,
    runs,
    level,
  };
}

/**
 * Parse a text run element
 */
function parseTextRun(rXml: string): PPTXTextRun {
  // Parse text content
  const tMatch = rXml.match(/<a:t>([^<]*)<\/a:t>/);
  const text = tMatch ? decodeXmlEntities(tMatch[1]) : '';
  
  // Parse formatting from rPr (run properties)
  const rPrMatch = rXml.match(/<a:rPr(?:\s+[^>]*)?>(?:<\/a:rPr>)?/);
  const formatting: Partial<PPTXTextRun> = {};
  
  if (rPrMatch) {
    const rPr = rPrMatch[0];
    
    // Bold
    formatting.bold = rPr.includes('b="1"') || rPr.includes('<a:b/>');
    
    // Italic
    formatting.italic = rPr.includes('i="1"') || rPr.includes('<a:i/>');
    
    // Underline
    formatting.underline = rPr.includes('u="sng"') || rPr.includes('<a:u/>');
    
    // Font size (in hundredths of a point)
    const szMatch = rPr.match(/sz="(\d+)"/);
    if (szMatch) {
      formatting.fontSize = parseInt(szMatch[1], 10) / 100;
    }
    
    // Color
    const colorMatch = rPr.match(/<a:solidFill>\s*<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/);
    if (colorMatch) {
      formatting.color = `#${colorMatch[1]}`;
    }
  }
  
  return {
    text,
    ...formatting,
  };
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

/**
 * Parse document metadata from core.xml
 */
function parseMetadata(zipData: Record<string, Uint8Array>): PPTXMetadata {
  const corePath = 'docProps/core.xml';
  const appPath = 'docProps/app.xml';
  const data = zipData[corePath];
  const appData = zipData[appPath];
  
  const metadata: PPTXMetadata = {};
  
  if (data) {
    const xml = strFromU8(data);
    
    metadata.title = extractXmlTag(xml, 'dc:title');
    metadata.subject = extractXmlTag(xml, 'dc:subject');
    metadata.creator = extractXmlTag(xml, 'dc:creator');
    metadata.keywords = extractXmlTag(xml, 'cp:keywords');
    metadata.description = extractXmlTag(xml, 'dc:description');
    metadata.lastModifiedBy = extractXmlTag(xml, 'cp:lastModifiedBy');
    metadata.revision = extractXmlTag(xml, 'cp:revision');
    metadata.category = extractXmlTag(xml, 'cp:category');
    
    const created = extractXmlTag(xml, 'dcterms:created');
    if (created) metadata.createdAt = new Date(created);
    
    const modified = extractXmlTag(xml, 'dcterms:modified');
    if (modified) metadata.modifiedAt = new Date(modified);
  }
  
  if (appData) {
    const xml = strFromU8(appData);
    metadata.application = extractXmlTag(xml, 'Application');
    metadata.company = extractXmlTag(xml, 'Company');
  }
  
  return metadata;
}

/**
 * Extract content from XML tag
 */
function extractXmlTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeXmlEntities(match[1]) || undefined : undefined;
}

/**
 * Generate plain text representation of presentation
 */
function generateText(slides: PPTXSlide[], metadata: PPTXMetadata): string {
  const parts: string[] = [];
  
  // Add metadata header
  if (metadata.title) {
    parts.push(`# ${metadata.title}`);
    parts.push('');
  }
  
  if (metadata.subject) {
    parts.push(`**Subject:** ${metadata.subject}`);
  }
  
  if (metadata.creator) {
    parts.push(`**Author:** ${metadata.creator}`);
  }
  
  if (parts.length > 0) {
    parts.push('');
    parts.push('---');
    parts.push('');
  }
  
  // Add slides
  for (const slide of slides) {
    parts.push(`## Slide ${slide.number}${slide.title ? `: ${slide.title}` : ''}`);
    parts.push('');
    
    for (const shape of slide.shapes) {
      if (shape.paragraphs.length > 0) {
        // Add context based on shape type
        if (shape.type === 'title') {
          // Already shown in slide header
          continue;
        }
        
        for (const paragraph of shape.paragraphs) {
          // Add indentation based on level
          const indent = paragraph.level ? '  '.repeat(paragraph.level) : '';
          
          // Add bullet for body text with levels
          const bullet = shape.type === 'body' && paragraph.level !== undefined
            ? `${'  '.repeat(paragraph.level || 0)}- `
            : '';
          
          parts.push(`${indent}${bullet}${paragraph.text}`);
        }
        
        parts.push(''); // Empty line between shapes
      }
    }
    
    parts.push('');
  }
  
  return parts.join('\n');
}

/**
 * Convert PPTX to Markdown format
 */
export function convertToMarkdown(parsed: ParsedPPTX): string {
  return generateText(parsed.slides, parsed.metadata);
}

/**
 * Extract specific slide by number
 */
export function extractSlide(parsed: ParsedPPTX, slideNumber: number): PPTXSlide | undefined {
  return parsed.slides.find(s => s.number === slideNumber);
}

/**
 * Extract slides by shape type
 */
export function extractSlidesByType(parsed: ParsedPPTX, type: PPTXShape['type']): PPTXSlide[] {
  return parsed.slides.filter(s => s.shapes.some(sh => sh.type === type));
}

/**
 * Get all text from a specific slide
 */
export function getSlideText(slide: PPTXSlide): string {
  return slide.text;
}

/**
 * Get presentation outline (titles only)
 */
export function getOutline(parsed: ParsedPPTX): string[] {
  return parsed.slides
    .map(s => s.title || `Slide ${s.number}`)
    .filter(Boolean) as string[];
}

/**
 * Search for text in presentation
 */
export function searchInPPTX(parsed: ParsedPPTX, query: string): Array<{
  slide: number;
  context: string;
}> {
  const results: Array<{ slide: number; context: string }> = [];
  const lowerQuery = query.toLowerCase();
  
  for (const slide of parsed.slides) {
    const lowerText = slide.text.toLowerCase();
    if (lowerText.includes(lowerQuery)) {
      // Find context around match
      const index = lowerText.indexOf(lowerQuery);
      const start = Math.max(0, index - 50);
      const end = Math.min(slide.text.length, index + query.length + 50);
      const context = slide.text.slice(start, end);
      
      results.push({
        slide: slide.number,
        context: `...${context}...`,
      });
    }
  }
  
  return results;
}

/**
 * Validate if buffer is a valid PPTX file
 */
export function isValidPPTX(buffer: Buffer): boolean {
  try {
    // Check for ZIP magic bytes
    if (buffer.length < 4) return false;
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) return false;
    
    // Try to unzip and check for required files
    const zipData = unzipSync(new Uint8Array(buffer));
    return 'ppt/presentation.xml' in zipData;
  } catch {
    return false;
  }
}

/**
 * PPTX Parser Error
 */
export class PPTXParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PPTXParserError';
  }
}
