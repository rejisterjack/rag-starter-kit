/**
 * Self-Query Module
 * 
 * Extracts structured filters from natural language queries using an LLM.
 * Converts queries like "documents from last month about billing" into:
 * - Query: "billing"
 * - Filters: { dateRange: { from: ..., to: ... } }
 */

import { generateChatCompletion } from '@/lib/ai';
import type { RetrievalFilters, SelfQueryResult } from './types';

/**
 * System prompt for self-query transformation
 */
const SELF_QUERY_SYSTEM_PROMPT = `You are an expert at extracting structured filters from natural language queries.
Your task is to analyze user queries and extract any metadata filters they imply.

Available filter fields:
- documentTypes: Array of document types ("PDF", "DOCX", "TXT", "MD", "HTML")
- dateRange: Object with "from" and "to" ISO dates
- tags: Array of tag strings

Guidelines:
1. Extract explicit filters mentioned in the query
2. Infer implicit filters from context (e.g., "last month" → dateRange)
3. Remove filter-related terms from the final query
4. Return only the structured data, no explanations
5. Use ISO 8601 format for dates
6. If no filters are found, return empty filters object

Examples:

Query: "Show me PDF documents from last week about revenue"
Output:
{
  "query": "revenue",
  "filters": {
    "documentTypes": ["PDF"],
    "dateRange": {
      "from": "2024-01-01T00:00:00Z",
      "to": "2024-01-07T23:59:59Z"
    }
  }
}

Query: "What did the CEO say about quarterly earnings?"
Output:
{
  "query": "CEO quarterly earnings",
  "filters": {}
}

Query: "Find documents tagged as 'financial' from January"
Output:
{
  "query": "",
  "filters": {
    "tags": ["financial"],
    "dateRange": {
      "from": "2024-01-01T00:00:00Z",
      "to": "2024-01-31T23:59:59Z"
    }
  }
}`;

/**
 * User prompt template
 */
const SELF_QUERY_USER_PROMPT = `Current date: {current_date}

User Query: {query}

Extract filters and return JSON:`;

/**
 * Self-Query Transformer class
 */
export class SelfQueryTransformer {
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = SELF_QUERY_SYSTEM_PROMPT;
  }

  /**
   * Transform a natural language query into structured query + filters
   * 
   * @param query - Natural language user query
   * @returns Structured query and filters
   */
  async transform(query: string): Promise<SelfQueryResult> {
    try {
      const prompt = SELF_QUERY_USER_PROMPT
        .replace('{current_date}', new Date().toISOString())
        .replace('{query}', query);

      const { text } = await generateChatCompletion(
        [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.1 } // Low temperature for deterministic output
      );

      // Parse the JSON response
      const result = this.parseResponse(text);
      
      console.log('[SelfQueryTransformer] Transformed query:', {
        original: query,
        extracted: result.query,
        filters: result.filters,
      });

      return result;
    } catch (error) {
      console.error('[SelfQueryTransformer] Transformation failed:', error);
      // Return original query on failure
      return { query, filters: {} };
    }
  }

  /**
   * Parse the LLM response into structured format
   */
  private parseResponse(response: string): SelfQueryResult {
    try {
      // Try to find JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and transform
      const result: SelfQueryResult = {
        query: String(parsed.query ?? '').trim(),
        filters: this.parseFilters(parsed.filters ?? {}),
      };

      return result;
    } catch (error) {
      console.error('[SelfQueryTransformer] Parse error:', error);
      throw error;
    }
  }

  /**
   * Parse and validate filters from parsed JSON
   */
  private parseFilters(filtersData: Record<string, unknown>): RetrievalFilters {
    const filters: RetrievalFilters = {};

    // Document types
    if (Array.isArray(filtersData.documentTypes)) {
      filters.documentTypes = filtersData.documentTypes
        .map((t) => String(t).toUpperCase())
        .filter((t) => ['PDF', 'DOCX', 'TXT', 'MD', 'HTML'].includes(t));
    }

    // Date range
    if (filtersData.dateRange && typeof filtersData.dateRange === 'object') {
      const dr = filtersData.dateRange as Record<string, string>;
      if (dr.from || dr.to) {
        filters.dateRange = {
          from: dr.from ? new Date(dr.from) : new Date(0),
          to: dr.to ? new Date(dr.to) : new Date(),
        };
      }
    }

    // Tags
    if (Array.isArray(filtersData.tags)) {
      filters.tags = filtersData.tags.map((t) => String(t));
    }

    // Document IDs
    if (Array.isArray(filtersData.documentIds)) {
      filters.documentIds = filtersData.documentIds.map((id) => String(id));
    }

    // Metadata
    if (filtersData.metadata && typeof filtersData.metadata === 'object') {
      filters.metadata = filtersData.metadata as Record<string, unknown>;
    }

    return filters;
  }

  /**
   * Batch transform multiple queries
   */
  async transformBatch(queries: string[]): Promise<SelfQueryResult[]> {
    return Promise.all(queries.map((q) => this.transform(q)));
  }
}

/**
 * Convenience function for self-query transformation
 */
export async function transformQuery(query: string): Promise<SelfQueryResult> {
  const transformer = new SelfQueryTransformer();
  return transformer.transform(query);
}

/**
 * Rule-based self-query fallback (no LLM required)
 * Extracts simple date and document type filters using regex patterns
 */
export function transformQueryFallback(query: string): SelfQueryResult {
  const filters: RetrievalFilters = {};
  let extractedQuery = query;

  // Extract document types
  const docTypePattern = /\b(pdf|docx?|txt|md|markdown|html?)\s+documents?\b/gi;
  const docTypeMatches = query.match(docTypePattern);
  if (docTypeMatches) {
    filters.documentTypes = docTypeMatches.map((m) => {
      const type = m.toLowerCase().replace(/\s+documents?/, '');
      if (type === 'doc' || type === 'docx') return 'DOCX';
      if (type === 'md' || type === 'markdown') return 'MD';
      if (type === 'htm' || type === 'html') return 'HTML';
      return type.toUpperCase();
    });
    extractedQuery = extractedQuery.replace(docTypePattern, '').trim();
  }

  // Extract date ranges
  const datePatterns = [
    // "last week", "past week", "previous week"
    {
      pattern: /\b(last|past|previous)\s+week\b/gi,
      getRange: () => ({
        from: getRelativeDate(-7),
        to: new Date(),
      }),
    },
    // "last month", "past month"
    {
      pattern: /\b(last|past|previous)\s+month\b/gi,
      getRange: () => ({
        from: getRelativeDate(-30),
        to: new Date(),
      }),
    },
    // "last year", "past year"
    {
      pattern: /\b(last|past|previous)\s+year\b/gi,
      getRange: () => ({
        from: getRelativeDate(-365),
        to: new Date(),
      }),
    },
    // "yesterday"
    {
      pattern: /\byesterday\b/gi,
      getRange: () => ({
        from: getRelativeDate(-1),
        to: getRelativeDate(-1),
      }),
    },
    // "today"
    {
      pattern: /\btoday\b/gi,
      getRange: () => ({
        from: new Date(),
        to: new Date(),
      }),
    },
  ];

  for (const { pattern, getRange } of datePatterns) {
    if (pattern.test(extractedQuery)) {
      filters.dateRange = getRange();
      extractedQuery = extractedQuery.replace(pattern, '').trim();
      break; // Only take the first date pattern
    }
  }

  // Clean up extracted query
  extractedQuery = extractedQuery
    .replace(/\s+/g, ' ')
    .replace(/^\s*from\s+/i, '')
    .replace(/^\s*about\s+/i, '')
    .trim();

  return { query: extractedQuery || query, filters };
}

/**
 * Helper function to get date relative to now
 */
function getRelativeDate(daysOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Convert natural language sort instructions to sort options
 */
export function parseSortInstructions(query: string): {
  query: string;
  sortBy?: 'relevance' | 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
} {
  const sortPatterns = [
    { pattern: /\b(most recent|newest|latest)\b/gi, sortBy: 'date' as const, sortOrder: 'desc' as const },
    { pattern: /\b(oldest|earliest)\b/gi, sortBy: 'date' as const, sortOrder: 'asc' as const },
    { pattern: /\b(alphabetical|a-z)\b/gi, sortBy: 'name' as const, sortOrder: 'asc' as const },
    { pattern: /\b(relevant|most relevant)\b/gi, sortBy: 'relevance' as const, sortOrder: 'desc' as const },
  ];

  let cleanedQuery = query;
  let sortBy: 'relevance' | 'date' | 'name' | undefined;
  let sortOrder: 'asc' | 'desc' | undefined;

  for (const { pattern, sortBy: sb, sortOrder: so } of sortPatterns) {
    if (pattern.test(query)) {
      sortBy = sb;
      sortOrder = so;
      cleanedQuery = cleanedQuery.replace(pattern, '').trim();
      break;
    }
  }

  return { query: cleanedQuery, sortBy, sortOrder };
}

/**
 * Check if a query likely contains filterable metadata
 */
export function hasMetadataFilters(query: string): boolean {
  const filterIndicators = [
    /\b(pdf|docx?|txt|md|html?)\s+documents?\b/gi,
    /\b(last|past|previous)\s+(week|month|year)\b/gi,
    /\b(yesterday|today)\b/gi,
    /\bfrom\s+\d{4}\b/gi,
    /\btagged?\s+(as\s+)?['"]?\w+['"]?/gi,
    /\b(most recent|newest|oldest)\b/gi,
  ];

  return filterIndicators.some((pattern) => pattern.test(query));
}
