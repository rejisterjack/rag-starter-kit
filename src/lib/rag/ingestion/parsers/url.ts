/**
 * Web URL Scraper with Playwright
 * Handles JavaScript-rendered pages, pagination, and content extraction
 */

import type { ParsedHTML, HTMLMetadata } from './html';
import { parseHTML } from './html';

export interface ScrapedPage extends ParsedHTML {
  url: string;
  finalUrl: string; // After redirects
  statusCode: number;
  contentType: string;
  scrapedAt: Date;
}

export interface URLScrapeOptions {
  timeout?: number;
  waitForSelector?: string;
  waitForNetworkIdle?: boolean;
  scrollToBottom?: boolean;
  maxScrolls?: number;
  userAgent?: string;
  includeImages?: boolean;
  includeLinks?: boolean;
}

export interface PaginationOptions {
  enabled: boolean;
  nextSelector?: string; // CSS selector for next page link
  maxPages?: number;
  stopOnDuplicate?: boolean;
}

export interface RobotsTxt {
  allowed: boolean;
  crawlDelay?: number;
  sitemap?: string[];
}

// Note: Playwright is an optional dependency
// Install with: npm install playwright
// And install browsers: npx playwright install

let playwright: typeof import('playwright') | null = null;

try {
  // Dynamic import for optional dependency
  const pw = require('playwright');
  playwright = pw;
} catch {
  // Playwright not installed
  console.warn('Playwright not installed. URL scraping will use fetch fallback.');
}

/**
 * Scrape a URL and extract content
 */
export async function scrapeURL(
  url: string,
  options: URLScrapeOptions = {}
): Promise<ScrapedPage> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new URLScraperError(`Invalid URL: ${url}`);
  }

  // Check robots.txt
  const robots = await checkRobotsTxt(parsedUrl.origin);
  if (!robots.allowed) {
    throw new URLScraperError(`URL blocked by robots.txt: ${url}`);
  }

  // Respect crawl delay
  if (robots.crawlDelay) {
    await sleep(robots.crawlDelay * 1000);
  }

  // Use Playwright if available, otherwise fetch
  if (playwright) {
    return scrapeWithPlaywright(url, options);
  } else {
    return scrapeWithFetch(url, options);
  }
}

/**
 * Scrape using Playwright for JavaScript-rendered content
 */
async function scrapeWithPlaywright(
  url: string,
  options: URLScrapeOptions
): Promise<ScrapedPage> {
  if (!playwright) {
    throw new URLScraperError('Playwright not available');
  }

  const browser = await playwright.chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: options.userAgent || getDefaultUserAgent(),
    });

    const page = await context.newPage();

    // Set timeout
    const timeout = options.timeout || 30000;
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    // Navigate to URL
    const response = await page.goto(url, {
      waitUntil: options.waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
    });

    if (!response) {
      throw new URLScraperError(`Failed to load page: ${url}`);
    }

    const statusCode = response.status();
    const finalUrl = page.url();
    const contentType = response.headers()['content-type'] || 'text/html';

    // Wait for specific selector if provided
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout });
    }

    // Scroll to bottom for lazy-loaded content
    if (options.scrollToBottom) {
      await scrollPageToBottom(page, options.maxScrolls || 10);
    }

    // Get page content
    const html = await page.content();

    // Parse content
    const parsed = parseHTML(Buffer.from(html), {
      baseUrl: finalUrl,
      extractMainContent: true,
      includeImages: options.includeImages,
      includeLinks: options.includeLinks,
    });

    return {
      ...parsed,
      url,
      finalUrl,
      statusCode,
      contentType,
      scrapedAt: new Date(),
    };
  } finally {
    await browser.close();
  }
}

/**
 * Scrape using fetch as fallback
 */
async function scrapeWithFetch(
  url: string,
  options: URLScrapeOptions
): Promise<ScrapedPage> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': options.userAgent || getDefaultUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new URLScraperError(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const finalUrl = response.url;
    const contentType = response.headers.get('content-type') || 'text/html';

    const parsed = parseHTML(Buffer.from(html), {
      baseUrl: finalUrl,
      extractMainContent: true,
      includeImages: options.includeImages,
      includeLinks: options.includeLinks,
    });

    return {
      ...parsed,
      url,
      finalUrl,
      statusCode: response.status,
      contentType,
      scrapedAt: new Date(),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Scroll page to bottom for lazy-loaded content
 */
async function scrollPageToBottom(
  page: import('playwright').Page,
  maxScrolls: number
): Promise<void> {
  let previousHeight = 0;
  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    
    if (currentHeight === previousHeight) {
      break;
    }

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await sleep(500); // Wait for content to load
    previousHeight = currentHeight;
    scrollCount++;
  }

  // Scroll back to top
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

/**
 * Scrape paginated content
 */
export async function* scrapePaginated(
  startUrl: string,
  options: URLScrapeOptions = {},
  pagination: PaginationOptions = { enabled: false }
): AsyncGenerator<ScrapedPage, void, unknown> {
  if (!pagination.enabled) {
    yield await scrapeURL(startUrl, options);
    return;
  }

  const seenUrls = new Set<string>();
  let currentUrl: string | null = startUrl;
  let pageCount = 0;
  const maxPages = pagination.maxPages || 10;

  while (currentUrl && pageCount < maxPages) {
    // Check for duplicates
    if (seenUrls.has(currentUrl)) {
      if (pagination.stopOnDuplicate) {
        break;
      }
    }
    seenUrls.add(currentUrl);

    // Scrape current page
    const page = await scrapeURL(currentUrl, options);
    yield page;
    pageCount++;

    // Find next page link
    if (pagination.nextSelector && page.links.length > 0) {
      const nextLink = page.links.find(link => {
        const text = link.text.toLowerCase();
        return text.includes('next') || 
               text.includes('»') || 
               text.includes('→') ||
               link.href.includes('page=') && 
               parseInt(link.href.match(/page=(\d+)/)?.[1] || '0') > pageCount;
      });

      currentUrl = nextLink?.href || null;
    } else {
      currentUrl = null;
    }
  }
}

/**
 * Check robots.txt for crawl permissions
 */
async function checkRobotsTxt(origin: string): Promise<RobotsTxt> {
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': getDefaultUserAgent() },
    });

    if (!response.ok) {
      return { allowed: true }; // No robots.txt means allowed
    }

    const content = await response.text();
    const lines = content.split('\n');
    
    let userAgentRelevant = false;
    let allowed = true;
    let crawlDelay: number | undefined;
    const sitemaps: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || !trimmed) continue;

      // Parse directives
      const [directive, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      switch (directive.toLowerCase()) {
        case 'user-agent':
          // Check if this applies to us ("*" or contains "bot")
          userAgentRelevant = value === '*' || 
                              value.toLowerCase().includes('bot') ||
                              value.toLowerCase().includes('crawler');
          break;
        
        case 'disallow':
          if (userAgentRelevant && value) {
            allowed = false;
          }
          break;
        
        case 'allow':
          if (userAgentRelevant && value) {
            allowed = true;
          }
          break;
        
        case 'crawl-delay':
          if (userAgentRelevant) {
            crawlDelay = parseFloat(value);
          }
          break;
        
        case 'sitemap':
          sitemaps.push(value);
          break;
      }
    }

    return { allowed, crawlDelay, sitemap: sitemaps };
  } catch {
    return { allowed: true }; // Default to allowed on error
  }
}

/**
 * Extract article content with enhanced processing
 */
export async function scrapeArticle(
  url: string,
  options: URLScrapeOptions = {}
): Promise<ScrapedPage & { isArticle: boolean }> {
  const scraped = await scrapeURL(url, {
    ...options,
    extractMainContent: true,
  });

  // Check if content appears to be an article
  const isArticle = checkIfArticle(scraped);

  return {
    ...scraped,
    isArticle,
  };
}

/**
 * Check if scraped content is an article
 */
function checkIfArticle(scraped: ScrapedPage): boolean {
  const indicators = [
    scraped.metadata.publishedDate,
    scraped.metadata.author,
    scraped.metadata.ogTitle,
    scraped.sections.length > 0,
    scraped.wordCount > 200,
  ];

  const score = indicators.filter(Boolean).length;
  return score >= 3;
}

/**
 * Get default user agent string
 */
function getDefaultUserAgent(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0' +
         ' (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0' +
         ' RAGBot/1.0 (+https://example.com/bot)';
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Custom error class for URL scraper
 */
export class URLScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'URLScraperError';
  }
}

/**
 * Batch scrape multiple URLs
 */
export async function batchScrapeURLs(
  urls: string[],
  options: URLScrapeOptions = {},
  concurrency: number = 3
): Promise<Array<{ url: string; result?: ScrapedPage; error?: string }>> {
  const results: Array<{ url: string; result?: ScrapedPage; error?: string }> = [];
  
  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        try {
          const result = await scrapeURL(url, options);
          return { url, result };
        } catch (error) {
          return {
            url,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );
    
    results.push(...batchResults);
  }

  return results;
}
