/**
 * Tools System
 *
 * Exports all tools for use by agents and other components.
 */

import { z } from 'zod';

// Calculator tool
export {
  calculate,
  calculateBatch,
  calculatorTool,
  convert,
} from './calculator';
// Code executor tool
export {
  codeExecutorTool,
  executeCode,
  executeCodeBatch,
} from './code-executor';
// Document tools
export {
  compareDocumentsTool,
  documentMetadataTool,
  documentSummaryTool,
  documentTools,
  searchDocumentsTool,
  semanticSearchTool,
} from './document-tools';
// Core types
export {
  createErrorResult,
  createSuccessResult,
  createTool,
  type Tool,
  ToolRegistry,
  type ToolResult,
} from './types';
// Web search tool
export {
  createWebSearchTool,
  DuckDuckGoProvider,
  getDefaultWebSearchProvider,
  SerpAPIProvider,
  TavilyProvider,
  type WebSearchOptions,
  type WebSearchProvider,
  type WebSearchResult,
} from './web-search';

// Re-import for use in this file
import { calculatorTool } from './calculator';
import { codeExecutorTool } from './code-executor';
import {
  compareDocumentsTool,
  documentMetadataTool,
  documentSummaryTool,
  searchDocumentsTool,
  semanticSearchTool,
} from './document-tools';
import { ToolRegistry } from './types';
import { createWebSearchTool, getDefaultWebSearchProvider } from './web-search';

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
    codeExecutorTool,
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
