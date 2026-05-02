/**
 * Web Search Tool
 *
 * Provides interfaces for popular search APIs like Tavily, SerpAPI, DuckDuckGo.
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { Source } from '@/types';
import { createErrorResult, createSuccessResult, createTool } from './types';

// ============================================================================
// Types
// ============================================================================

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
  source?: string;
}

export interface WebSearchProvider {
  name: string;
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
}

export interface WebSearchOptions {
  maxResults?: number;
  includeAnswer?: boolean;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

// ============================================================================
// Tavily Provider
// ============================================================================

export class TavilyProvider implements WebSearchProvider {
  name = 'tavily';
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: options.maxResults ?? 5,
        include_answer: options.includeAnswer ?? false,
        search_depth: options.searchDepth ?? 'basic',
        include_domains: options.includeDomains,
        exclude_domains: options.excludeDomains,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.statusText}`);
    }

    const data = await response.json();

    return (data.results || []).map(
      (r: { title: string; url: string; content: string; published_date?: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        content: r.content,
        publishedDate: r.published_date,
        source: 'tavily',
      })
    );
  }
}

// ============================================================================
// SerpAPI Provider
// ============================================================================

export class SerpAPIProvider implements WebSearchProvider {
  name = 'serpapi';
  private apiKey: string;
  private baseUrl = 'https://serpapi.com/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      api_key: this.apiKey,
      engine: 'google',
      num: String(options.maxResults ?? 5),
    });

    if (options.timeRange) {
      const tbsMap: Record<string, string> = {
        day: 'qdr:d',
        week: 'qdr:w',
        month: 'qdr:m',
        year: 'qdr:y',
      };
      params.append('tbs', tbsMap[options.timeRange]);
    }

    const response = await fetch(`${this.baseUrl}?${params}`);

    if (!response.ok) {
      throw new Error(`SerpAPI search failed: ${response.statusText}`);
    }

    const data = await response.json();

    return (data.organic_results || []).map(
      (r: { title: string; link: string; snippet: string }) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        source: 'serpapi',
      })
    );
  }
}

// ============================================================================
// DuckDuckGo Provider (No API key required)
// Uses DuckDuckGo's instant answer API
// ============================================================================

export class DuckDuckGoProvider implements WebSearchProvider {
  name = 'duckduckgo';

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    // Use DuckDuckGo's HTML interface for web results
    const maxResults = options.maxResults ?? 5;

    try {
      // Fetch DuckDuckGo HTML results page
      const params = new URLSearchParams({
        q: query,
        kl: 'us-en', // Region
        safe: 'off',
      });

      const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo search failed: ${response.statusText}`);
      }

      const html = await response.text();
      const results = this.parseDuckDuckGoResults(html);

      return results.slice(0, maxResults);
    } catch (error: unknown) {
      // Fallback to instant answers API if HTML parsing fails
      logger.debug('DuckDuckGo HTML search failed, falling back to instant answers', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.fetchInstantAnswers(query, maxResults);
    }
  }

  private parseDuckDuckGoResults(html: string): WebSearchResult[] {
    const results: WebSearchResult[] = [];

    // Parse DuckDuckGo HTML results
    // Result format: <div class="result">...</div>
    const resultRegex =
      /<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>\s*(?=<div class="result"|<div id="links")/gi;
    const titleRegex = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/i;
    const urlRegex = /<a[^>]*href="([^"]+)"/i;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i;

    const matches = html.match(resultRegex) || [];

    for (const resultHtml of matches.slice(0, 10)) {
      const titleMatch = resultHtml.match(titleRegex);
      const urlMatch = resultHtml.match(urlRegex);
      const snippetMatch = resultHtml.match(snippetRegex);

      if (titleMatch && urlMatch) {
        const title = this.cleanHtml(titleMatch[1]);
        let url = urlMatch[1];
        const snippet = snippetMatch ? this.cleanHtml(snippetMatch[1]) : '';

        // Handle DuckDuckGo redirect URLs
        if (url.startsWith('//')) {
          url = `https:${url}`;
        } else if (url.startsWith('/l/?')) {
          // Extract actual URL from redirect
          const uddgMatch = url.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
        }

        results.push({
          title,
          url,
          snippet,
          source: 'duckduckgo',
        });
      }
    }

    return results;
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private async fetchInstantAnswers(query: string, maxResults: number): Promise<WebSearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        no_html: '1',
        skip_disambig: '1',
      });

      const response = await fetch(`https://api.duckduckgo.com/?${params}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const results: WebSearchResult[] = [];

      // Add abstract if available
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: data.AbstractText,
          source: 'duckduckgo',
        });
      }

      // Add related topics
      if (data.RelatedTopics) {
        const topics = Array.isArray(data.RelatedTopics)
          ? data.RelatedTopics
          : [data.RelatedTopics];
        for (const topic of topics.slice(0, maxResults - 1)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Name || topic.Text.slice(0, 50),
              url: topic.FirstURL,
              snippet: topic.Text,
              source: 'duckduckgo',
            });
          }
        }
      }

      return results;
    } catch (error: unknown) {
      logger.debug('DuckDuckGo instant answer search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}

// ============================================================================
// Web Search Tool
// ============================================================================

const WebSearchParamsSchema = z.object({
  query: z.string().describe('The search query'),
  maxResults: z.number().optional().describe('Maximum number of results (default: 5)'),
  includeContent: z.boolean().optional().describe('Include full content in results'),
});

type WebSearchParams = z.infer<typeof WebSearchParamsSchema>;

/**
 * Create web search tool with a specific provider
 */
export function createWebSearchTool(provider: WebSearchProvider) {
  return createTool<WebSearchParams>({
    name: 'web_search',
    description: `Search the web for current information.

Use this when:
- The user asks about current events or recent news
- Information might not be in the document store
- You need external, up-to-date information
- The query involves real-time data (weather, stock prices, etc.)

The tool returns search results with titles, URLs, and snippets.`,
    parameters: WebSearchParamsSchema,
    execute: async (params) => {
      try {
        const { query, maxResults = 5, includeContent = false } = params;

        const results = await provider.search(query, {
          maxResults,
          includeAnswer: true,
        });

        if (results.length === 0) {
          return createErrorResult('No results found for the query');
        }

        // Format results as text
        const formattedResults = results
          .map((r, i) => {
            let text = `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`;
            if (includeContent && r.content) {
              text += `\n   Content: ${r.content.slice(0, 500)}...`;
            }
            return text;
          })
          .join('\n\n');

        // Convert to Source format for citations
        const sources: Source[] = results.map((r, i) => ({
          id: `web-${i}`,
          content: `${r.title}\n${r.snippet}`,
          metadata: {
            documentId: r.url,
            documentName: r.title,
            source: r.source || 'web',
            url: r.url,
            chunkIndex: i,
            totalChunks: results.length,
          },
          similarity: 1 - i * 0.1, // Decreasing relevance
        }));

        return createSuccessResult(
          `Found ${results.length} results:\n\n${formattedResults}`,
          sources
        );
      } catch (error) {
        return createErrorResult(
          `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
  });
}

/**
 * Get the default web search provider based on environment variables
 */
export function getDefaultWebSearchProvider(): WebSearchProvider {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const serpKey = process.env.SERPAPI_KEY;

  if (tavilyKey) {
    return new TavilyProvider(tavilyKey);
  }

  if (serpKey) {
    return new SerpAPIProvider(serpKey);
  }

  // Default to DuckDuckGo (no API key required)
  return new DuckDuckGoProvider();
}
