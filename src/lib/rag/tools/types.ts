/**
 * Tools System - Type Definitions
 *
 * Defines the core interfaces for tools that can be used by agents.
 */

import { z } from 'zod';
import type { Source } from '@/types';

// ============================================================================
// Core Tool Types
// ============================================================================

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  sources?: Source[];
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get OpenAI function calling format
   */
  getOpenAIFunctions(): Array<{
    name: string;
    description: string;
    parameters: unknown;
  }> {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    }));
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Zod schema to JSON Schema
 */
function zodToJsonSchema(schema: z.ZodSchema): unknown {
  // Simple conversion - in production, use zod-to-json-schema package
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToJson(value);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  return { type: 'object' };
}

function zodTypeToJson(zodType: z.ZodType): unknown {
  if (zodType instanceof z.ZodString) return { type: 'string' };
  if (zodType instanceof z.ZodNumber) return { type: 'number' };
  if (zodType instanceof z.ZodBoolean) return { type: 'boolean' };
  if (zodType instanceof z.ZodArray) {
    // Access element type through _def
    const elementType = (zodType as unknown as { _def: { type: z.ZodType } })._def.type;
    return {
      type: 'array',
      items: zodTypeToJson(elementType),
    };
  }
  if (zodType instanceof z.ZodOptional) {
    // Access the inner type through _def
    const innerType = (zodType as unknown as { _def: { innerType: z.ZodType } })._def.innerType;
    return zodTypeToJson(innerType);
  }
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType);
  }
  return { type: 'string' };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a tool from a function
 */
export function createTool<T>(config: {
  name: string;
  description: string;
  parameters: z.ZodSchema<T>;
  execute: (params: T) => Promise<ToolResult>;
}): Tool {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    execute: async (params: unknown) => {
      try {
        // Validate params
        const validated = config.parameters.parse(params);
        return await config.execute(validated);
      } catch (error) {
        return {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Validation failed',
        };
      }
    },
  };
}

/**
 * Create a successful tool result
 */
export function createSuccessResult(data: unknown, sources?: Source[]): ToolResult {
  return {
    success: true,
    data,
    sources,
  };
}

/**
 * Create an error tool result
 */
export function createErrorResult(error: string): ToolResult {
  return {
    success: false,
    data: null,
    error,
  };
}
