/**
 * Web Search Tool
 * 
 * Placeholder for web search integration.
 * Provides interfaces for popular search APIs like Tavily, SerpAPI, etc.
 */

import { z } from 'zod';
import { createTool, createSuccessResult, createErrorResult } from './types';
import type { Source } from '@/types';

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

  async search(
    query: string,
    options: WebSearchOptions = {}
  ): Promise<WebSearchResult[]> {
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
    
    return (data.results || []).map((r: {
      title: string;
      url: string;
      content: string;
      published_date?: string;
    }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      content: r.content,
      publishedDate: r.published_date,
      source: 'tavily',
    }));
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

  async search(
    query: string,
    options: WebSearchOptions = {}
  ): Promise<WebSearchResult[]> {
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
    
    return (data.organic_results || []).map((r: {
      title: string;
      link: string;
      snippet: string;
    }) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      source: 'serpapi',
    }));
  }
}

// ============================================================================
// DuckDuckGo Provider (No API key required)
// ============================================================================

export class DuckDuckGoProvider implements WebSearchProvider {
  name = 'duckduckgo';

  async search(
    query: string,
    options: WebSearchOptions = {}
  ): Promise<WebSearchResult[]> {
    // Note: This is a placeholder implementation
    // In production, you would use a proper DuckDuckGo search library
    // like duck-duck-scrape or similar
    
    throw new Error(
      'DuckDuckGo provider requires the duck-duck-scrape package. ' +
      'Install it with: npm install duck-duck-scrape'
    );
  }
}

// ============================================================================
// Mock Provider (for testing/development)
// ============================================================================

export class MockWebSearchProvider implements WebSearchProvider {
  name = 'mock';

  async search(
    query: string,
    options: WebSearchOptions = {}
  ): Promise<WebSearchResult[]> {
    // Return mock results for development/testing
    return [
      {
        title: `Mock result for: ${query}`,
        url: 'https://example.com/mock',
        snippet: `This is a mock search result for "${query}". In production, this would be replaced with real search results from your configured provider.`,
        source: 'mock',
      },
      {
        title: 'Another mock result',
        url: 'https://example.com/mock2',
        snippet: 'This demonstrates the web search tool structure without making actual API calls.',
        source: 'mock',
      },
    ].slice(0, options.maxResults ?? 5);
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

        // Convert to sources format
        const sources: Source[] = results.map((result, index) => ({
          id: `web-${index}`,
          content: includeContent && result.content 
            ? result.content 
            : `${result.title}\n${result.snippet}`,
          metadata: {
            documentId: `web-${index}`,
            documentName: result.title,
            source: result.source || provider.name,
            url: result.url,
            publishedDate: result.publishedDate,
            chunkIndex: index,
            totalChunks: results.length,
          },
        }));

        return createSuccessResult({
          query,
          results: results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            publishedDate: r.publishedDate,
          })),
          totalResults: results.length,
        }, sources);
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : 'Web search failed'
        );
      }
    },
  });
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create web search provider from environment variables
 */
export function createWebSearchProviderFromEnv(): WebSearchProvider {
  const provider = process.env.WEB_SEARCH_PROVIDER ?? 'mock';

  switch (provider) {
    case 'tavily':
      const tavilyKey = process.env.TAVILY_API_KEY;
      if (!tavilyKey) {
        console.warn('TAVILY_API_KEY not set, falling back to mock provider');
        return new MockWebSearchProvider();
      }
      return new TavilyProvider(tavilyKey);

    case 'serpapi':
      const serpKey = process.env.SERPAPI_KEY;
      if (!serpKey) {
        console.warn('SERPAPI_KEY not set, falling back to mock provider');
        return new MockWebSearchProvider();
      }
      return new SerpAPIProvider(serpKey);

    case 'duckduckgo':
      return new DuckDuckGoProvider();

    case 'mock':
    default:
      return new MockWebSearchProvider();
  }
}

/**
 * Create default web search tool from environment
 */
export function createWebSearchToolFromEnv() {
  const provider = createWebSearchProviderFromEnv();
  return createWebSearchTool(provider);
}

// ============================================================================
// Default Export
// ============================================================================

export const webSearchTool = createWebSearchToolFromEnv();
