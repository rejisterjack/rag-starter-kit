/**
 * HTML Parser for web content
 * Extracts main content while removing navigation, ads, and boilerplate
 */

import * as cheerio from 'cheerio';

export interface HTMLMetadata {
  title?: string;
  description?: string;
  author?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  publishedDate?: string;
  modifiedDate?: string;
}

export interface HTMLSection {
  tag: string;
  text: string;
  id?: string;
  class?: string;
}

export interface ParsedHTML {
  text: string;
  html: string;
  metadata: HTMLMetadata;
  sections: HTMLSection[];
  links: Array<{ href: string; text: string }>;
  images: Array<{ src: string; alt: string }>;
  wordCount: number;
  characterCount: number;
}

export interface HTMLParseOptions {
  baseUrl?: string;
  extractMainContent?: boolean;
  includeImages?: boolean;
  includeLinks?: boolean;
}

// Common selectors for content extraction (Readability-inspired)
const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.post-content',
  '.entry-content',
  '.article-content',
  '.post-body',
  '.content-body',
  '#content',
  '.content',
  '.main-content',
];

// Selectors to remove (noise reduction)
const NOISE_SELECTORS = [
  'script',
  'style',
  'nav',
  'header:not(article header)',
  'footer:not(article footer)',
  'aside',
  '.sidebar',
  '.advertisement',
  '.ads',
  '.ad',
  '.comments',
  '.social-share',
  '.related-posts',
  '.newsletter',
  '.cookie-banner',
  '.popup',
  '.modal',
  '[role="banner"]',
  '[role="complementary"]',
  '[role="navigation"]',
];

/**
 * Parse HTML buffer and extract structured content
 */
export function parseHTML(buffer: Buffer, options: HTMLParseOptions = {}): ParsedHTML {
  try {
    const html = buffer.toString('utf-8');
    const $ = cheerio.load(html, {
      decodeEntities: true,
      xmlMode: false,
    });

    // Extract metadata
    const metadata = extractMetadata($, options.baseUrl);

    // Extract main content
    const mainContent = extractMainContent($, options.extractMainContent !== false);

    // Extract sections
    const sections = extractSections($, mainContent);

    // Extract links
    const links = options.includeLinks !== false ? extractLinks($, options.baseUrl) : [];

    // Extract images
    const images = options.includeImages !== false ? extractImages($, options.baseUrl) : [];

    // Clean and extract text
    const text = cleanText(mainContent.text());

    // Calculate statistics
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const characterCount = text.length;

    return {
      text,
      html: $.html(),
      metadata,
      sections,
      links,
      images,
      wordCount,
      characterCount,
    };
  } catch (error) {
    console.error('HTML parsing error:', error);
    throw new HTMLParserError(
      `Failed to parse HTML: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract metadata from HTML head
 */
function extractMetadata($: cheerio.CheerioAPI, baseUrl?: string): HTMLMetadata {
  const metadata: HTMLMetadata = {};

  // Standard meta tags
  metadata.title = $('title').text().trim() || undefined;
  metadata.description = $('meta[name="description"]').attr('content') || undefined;
  metadata.author = $('meta[name="author"]').attr('content') || undefined;
  metadata.keywords = $('meta[name="keywords"]').attr('content') || undefined;
  metadata.canonicalUrl = $('link[rel="canonical"]').attr('href') || undefined;

  // Open Graph tags
  metadata.ogTitle = $('meta[property="og:title"]').attr('content') || undefined;
  metadata.ogDescription = $('meta[property="og:description"]').attr('content') || undefined;
  metadata.ogImage = $('meta[property="og:image"]').attr('content') || undefined;

  // Article tags
  metadata.publishedDate = 
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="publishedDate"]').attr('content') ||
    undefined;
  
  metadata.modifiedDate = 
    $('meta[property="article:modified_time"]').attr('content') ||
    undefined;

  // Resolve relative URLs
  if (baseUrl) {
    if (metadata.canonicalUrl && !metadata.canonicalUrl.startsWith('http')) {
      metadata.canonicalUrl = new URL(metadata.canonicalUrl, baseUrl).href;
    }
    if (metadata.ogImage && !metadata.ogImage.startsWith('http')) {
      metadata.ogImage = new URL(metadata.ogImage, baseUrl).href;
    }
  }

  return metadata;
}

/**
 * Extract main content using heuristics
 */
function extractMainContent($: cheerio.CheerioAPI, useHeuristics: boolean): cheerio.Cheerio<cheerio.Element> {
  if (!useHeuristics) {
    return $('body');
  }

  // Try common content selectors
  for (const selector of CONTENT_SELECTORS) {
    const element = $(selector).first();
    if (element.length && element.text().trim().length > 200) {
      return element;
    }
  }

  // Remove noise elements from body
  const body = $('body').clone();
  NOISE_SELECTORS.forEach(selector => {
    body.find(selector).remove();
  });

  // Score paragraphs to find main content area
  const paragraphs = body.find('p');
  const paragraphCounts = new Map<string, number>();

  paragraphs.each((_, elem) => {
    const parent = $(elem).parent();
    const parentTag = parent.prop('tagName')?.toLowerCase() || '';
    const parentClass = parent.attr('class') || '';
    const key = `${parentTag}.${parentClass}`;
    
    const text = $(elem).text().trim();
    if (text.length > 20) {
      paragraphCounts.set(key, (paragraphCounts.get(key) || 0) + 1);
    }
  });

  // Find parent with most paragraphs
  let maxCount = 0;
  let bestSelector = 'body';
  
  paragraphCounts.forEach((count, selector) => {
    if (count > maxCount) {
      maxCount = count;
      bestSelector = selector;
    }
  });

  // If we found a good content container, use it
  if (maxCount > 2) {
    const [tag, ...classParts] = bestSelector.split('.');
    const className = classParts.join('.');
    const selector = className ? `${tag}.${className}` : tag;
    const element = body.find(selector).first();
    if (element.length) {
      return element;
    }
  }

  return body;
}

/**
 * Extract structured sections from content
 */
function extractSections($: cheerio.CheerioAPI, content: cheerio.Cheerio<cheerio.Element>): HTMLSection[] {
  const sections: HTMLSection[] = [];

  // Extract headings and their associated content
  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  
  content.find(headingTags.join(', ')).each((_, elem) => {
    const $elem = $(elem);
    const tag = elem.tagName.toLowerCase();
    const text = cleanText($elem.text());
    
    if (text) {
      sections.push({
        tag,
        text,
        id: $elem.attr('id') || undefined,
        class: $elem.attr('class') || undefined,
      });
    }
  });

  return sections;
}

/**
 * Extract and normalize links
 */
function extractLinks($: cheerio.CheerioAPI, baseUrl?: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const seen = new Set<string>();

  $('a[href]').each((_, elem) => {
    const $elem = $(elem);
    let href = $elem.attr('href') || '';
    const text = cleanText($elem.text());

    // Skip anchors, javascript, mailto, tel
    if (href.startsWith('#') || href.startsWith('javascript:') || 
        href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    // Resolve relative URLs
    if (baseUrl && !href.startsWith('http')) {
      try {
        href = new URL(href, baseUrl).href;
      } catch {
        return; // Invalid URL
      }
    }

    // Deduplicate
    if (!seen.has(href)) {
      seen.add(href);
      links.push({ href, text: text || href });
    }
  });

  return links;
}

/**
 * Extract and normalize images
 */
function extractImages($: cheerio.CheerioAPI, baseUrl?: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = [];
  const seen = new Set<string>();

  $('img[src]').each((_, elem) => {
    const $elem = $(elem);
    let src = $elem.attr('src') || '';
    const alt = $elem.attr('alt') || '';

    // Skip data URIs for large images
    if (src.startsWith('data:')) {
      return;
    }

    // Resolve relative URLs
    if (baseUrl && !src.startsWith('http')) {
      try {
        src = new URL(src, baseUrl).href;
      } catch {
        return; // Invalid URL
      }
    }

    // Deduplicate
    if (!seen.has(src)) {
      seen.add(src);
      images.push({ src, alt });
    }
  });

  return images;
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .replace(/\n\s*\n/g, '\n\n')    // Preserve paragraph breaks
    .replace(/^\s+|\s+$/g, '')     // Trim
    .trim();
}

/**
 * Convert relative URL to absolute
 */
export function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http')) {
    return url;
  }
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Extract article content using readability algorithm
 */
export function extractArticle(html: string, baseUrl?: string): ParsedHTML {
  const parsed = parseHTML(Buffer.from(html), {
    baseUrl,
    extractMainContent: true,
    includeImages: true,
    includeLinks: false,
  });

  // Additional article-specific processing
  // This could include more sophisticated content extraction
  // using libraries like @mozilla/readability

  return parsed;
}

/**
 * Custom error class for HTML parser
 */
export class HTMLParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HTMLParserError';
  }
}

/**
 * Check if HTML appears to be an article/blog post
 */
export function isArticle(html: string): boolean {
  const $ = cheerio.load(html);
  
  // Check for article semantic elements
  const hasArticleTag = $('article').length > 0;
  const hasPublishedDate = $('meta[property="article:published_time"]').length > 0;
  const hasAuthor = $('meta[name="author"]').length > 0 || $('[rel="author"]').length > 0;
  
  // Check content density
  const textLength = $('body').text().length;
  const linkDensity = $('a').length / Math.max(textLength / 1000, 1);
  
  return hasArticleTag || hasPublishedDate || (hasAuthor && linkDensity < 0.5);
}
