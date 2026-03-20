/**
 * HTML Parser for web content
 * Extracts main content while removing navigation, ads, and boilerplate
 * Uses native DOM API (no external dependencies)
 */

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
  title: string;
  text: string;
  metadata: HTMLMetadata;
  sections: HTMLSection[];
  images: Array<{ src: string; alt: string }>;
  links: Array<{ href: string; text: string }>;
  wordCount: number;
  characterCount: number;
}

/**
 * Parse HTML content and extract main text
 */
export function parseHTML(buffer: Buffer): ParsedHTML {
  const html = buffer.toString('utf-8');
  
  // Extract metadata
  const metadata = extractMetadata(html);
  
  // Extract main content
  const mainContent = extractMainContent(html);
  
  // Extract sections
  const sections = extractSections(html);
  
  // Extract images
  const images = extractImages(html);
  
  // Extract links
  const links = extractLinks(html);
  
  // Clean and normalize text
  const cleanText = cleanHtmlText(mainContent);
  
  // Calculate word count
  const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;
  
  return {
    title: metadata.title || '',
    text: cleanText,
    metadata,
    sections,
    images,
    links,
    wordCount,
    characterCount: cleanText.length,
  };
}

/**
 * Extract metadata from HTML
 */
function extractMetadata(html: string): HTMLMetadata {
  const metadata: HTMLMetadata = {};
  
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    metadata.title = decodeHtmlEntities(titleMatch[1].trim());
  }
  
  // Meta tags
  const metaRegex = /<meta[^>]+>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const metaTag = match[0];
    
    // Description
    if (metaTag.match(/name=["']description["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.description = decodeHtmlEntities(contentMatch[1]);
    }
    
    // Author
    if (metaTag.match(/name=["']author["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.author = decodeHtmlEntities(contentMatch[1]);
    }
    
    // Keywords
    if (metaTag.match(/name=["']keywords["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.keywords = decodeHtmlEntities(contentMatch[1]);
    }
    
    // Canonical URL
    if (metaTag.match(/rel=["']canonical["']/i)) {
      const hrefMatch = metaTag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) metadata.canonicalUrl = hrefMatch[1];
    }
    
    // Open Graph tags
    if (metaTag.match(/property=["']og:title["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.ogTitle = decodeHtmlEntities(contentMatch[1]);
    }
    
    if (metaTag.match(/property=["']og:description["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.ogDescription = decodeHtmlEntities(contentMatch[1]);
    }
    
    if (metaTag.match(/property=["']og:image["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.ogImage = contentMatch[1];
    }
    
    // Published date
    if (metaTag.match(/name=["'](article:published_time|publishedDate|datePublished)["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.publishedDate = contentMatch[1];
    }
    
    // Modified date
    if (metaTag.match(/name=["'](article:modified_time|modifiedDate|dateModified)["']/i)) {
      const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
      if (contentMatch) metadata.modifiedDate = contentMatch[1];
    }
  }
  
  return metadata;
}

/**
 * Extract main content from HTML
 */
function extractMainContent(html: string): string {
  // Remove script and style tags
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ');
  
  // Try to find main content area
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    // Try article tag
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    } else {
      // Try content divs
      const contentDivMatch = content.match(/<div[^>]*(?:id|class)=["'](?:content|main|article)["'][^>]*>([\s\S]*?)<\/div>/i);
      if (contentDivMatch) {
        content = contentDivMatch[1];
      } else {
        // Fall back to body
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          content = bodyMatch[1];
        }
      }
    }
  }
  
  return content;
}

/**
 * Extract sections from HTML
 */
function extractSections(html: string): HTMLSection[] {
  const sections: HTMLSection[] = [];
  const headingRegex =/<(h[1-6])[^>]*>([^<]*)<\/(h[1-6])>/gi;
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    sections.push({
      tag: match[1],
      text: decodeHtmlEntities(match[2].trim()),
    });
  }
  
  return sections;
}

/**
 * Extract images from HTML
 */
function extractImages(html: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = [];
  const seen = new Set<string>();
  
  const imgRegex = /<img[^>]+>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const imgTag = match[0];
    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
    const altMatch = imgTag.match(/alt=["']([^"]*)["']/i);
    
    if (srcMatch) {
      const src = srcMatch[1];
      if (!seen.has(src) && !src.startsWith('data:')) {
        seen.add(src);
        images.push({
          src,
          alt: altMatch ? decodeHtmlEntities(altMatch[1]) : '',
        });
      }
    }
  }
  
  return images;
}

/**
 * Extract links from HTML
 */
function extractLinks(html: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const seen = new Set<string>();
  
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = decodeHtmlEntities(match[2].trim());
    
    if (!seen.has(href) && !href.startsWith('#') && !href.startsWith('javascript:')) {
      seen.add(href);
      links.push({ href, text });
    }
  }
  
  return links;
}

/**
 * Clean HTML text
 */
function cleanHtmlText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-');
}

/**
 * Scrape URL content with retry logic
 */
export async function scrapeURL(
  url: string,
  options: {
    timeout?: number;
    retries?: number;
    userAgent?: string;
  } = {}
): Promise<{
  text: string;
  html: string;
  metadata: HTMLMetadata;
  links: Array<{ href: string; text: string }>;
}> {
  const { timeout = 30000, retries = 3, userAgent = 'Mozilla/5.0 (compatible; RAGBot/1.0)' } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const parsed = parseHTML(Buffer.from(html));
      
      return {
        text: parsed.text,
        html,
        metadata: parsed.metadata,
        links: parsed.links,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw new Error(`Failed to scrape URL after ${retries} attempts: ${lastError?.message}`);
}
