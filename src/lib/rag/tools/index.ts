/**
 * Tools System
 * 
 * Exports all tools for use by agents and other components.
 */

import { z } from 'zod';

// Core types
export {
  type Tool,
  type ToolResult,
  ToolRegistry,
  createTool,
  createSuccessResult,
  createErrorResult,
} from './types';

// Calculator tool
export {
  calculatorTool,
  calculate,
  convert,
  calculateBatch,
} from './calculator';

// Web search tool
export {
  createWebSearchTool,
  getDefaultWebSearchProvider,
  type WebSearchProvider,
  type WebSearchResult,
  type WebSearchOptions,
  TavilyProvider,
  SerpAPIProvider,
  DuckDuckGoProvider,
} from './web-search';

// Document tools
export {
  searchDocumentsTool,
  documentSummaryTool,
  documentMetadataTool,
  semanticSearchTool,
  compareDocumentsTool,
  documentTools,
} from './document-tools';

// Re-import for use in this file
import { calculatorTool } from './calculator';
import { getDefaultWebSearchProvider, createWebSearchTool } from './web-search';
import {
  searchDocumentsTool,
  documentSummaryTool,
  documentMetadataTool,
  semanticSearchTool,
  compareDocumentsTool,
} from './document-tools';
import { ToolRegistry } from './types';

// Current time tool (simple utility)
export const currentTimeTool = {
  name: 'current_time',
  description: 'Get the current date and time',
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      success: true,
      data: {
        timestamp: now.toISOString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utc: now.toUTCString(),
      },
    };
  },
};

/**
 * Get all available tools
 */
export function getAllTools() {
  return [
    calculatorTool,
    createWebSearchTool(getDefaultWebSearchProvider()),
    searchDocumentsTool,
    documentSummaryTool,
    documentMetadataTool,
    semanticSearchTool,
    compareDocumentsTool,
    currentTimeTool,
  ];
}

/**
 * Create a tool registry with all tools pre-registered
 */
export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  getAllTools().forEach((tool) => registry.register(tool));
  return registry;
}
