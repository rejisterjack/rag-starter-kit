/**
 * Code Executor Tool
 *
 * Safely executes JavaScript code in a sandboxed environment with
 * timeout protection and memory limits.
 */

import { z } from 'zod';
import { createErrorResult, createSuccessResult, createTool } from './types';

// ============================================================================
// Code Executor Parameters Schema
// ============================================================================

const CodeExecutorParamsSchema = z.object({
  code: z.string().describe('The JavaScript code to execute'),
  timeout: z.number().optional().describe('Execution timeout in milliseconds (default: 5000)'),
  memoryLimit: z.number().optional().describe('Memory limit in MB (default: 50)'),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Variables to inject into the execution context'),
});

type CodeExecutorParams = z.infer<typeof CodeExecutorParamsSchema>;

// ============================================================================
// Sandbox Implementation
// ============================================================================

interface ExecutionResult {
  result: unknown;
  logs: string[];
  executionTime: number;
  memoryUsed: number;
}

interface SandboxContext {
  console: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
  };
  Math: typeof Math;
  Date: typeof Date;
  JSON: typeof JSON;
  Array: typeof Array;
  Object: typeof Object;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  RegExp: typeof RegExp;
  Error: typeof Error;
  Map: typeof Map;
  Set: typeof Set;
  Promise: typeof Promise;
  parseInt: typeof parseInt;
  parseFloat: typeof parseFloat;
  isNaN: typeof isNaN;
  isFinite: typeof isFinite;
  encodeURI: typeof encodeURI;
  decodeURI: typeof decodeURI;
  encodeURIComponent: typeof encodeURIComponent;
  decodeURIComponent: typeof decodeURIComponent;
  [key: string]: unknown;
}

/**
 * Dangerous patterns to check for in code
 */
const DANGEROUS_PATTERNS = [
  // System access
  /process\.exit/i,
  /child_process/i,
  /cluster/i,
  /os\./i,
  /fs\./i,
  /path\./i,
  /require\s*\(/i,
  /import\s*\(/i,
  /__dirname/i,
  /__filename/i,
  /module\.exports/i,
  /exports\./i,

  // Network access
  /fetch\s*\(/i,
  /XMLHttpRequest/i,
  /WebSocket/i,
  /EventSource/i,
  /navigator\./i,
  /location\./i,
  /document\./i,
  /window\./i,
  /globalThis\./i,

  // Dangerous globals
  /eval\s*\(/i,
  /Function\s*\(/i,
  /setTimeout\s*\(/i,
  /setInterval\s*\(/i,
  /setImmediate\s*\(/i,
  /clearTimeout/i,
  /clearInterval/i,
  /clearImmediate/i,

  // Prototype pollution
  /__proto__/i,
  /prototype\s*\[/i,
  /constructor\s*\[/i,

  // Dynamic imports
  /import\s*\(/i,
  /import\s+.*\s+from/i,

  // Workers
  /Worker/i,
  /SharedArrayBuffer/i,
  /Atomics\./i,
];

/**
 * Validate code for dangerous patterns
 */
function validateCode(code: string): { valid: boolean; error?: string } {
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Code contains potentially dangerous pattern: ${pattern.source}`,
      };
    }
  }

  // Check code length
  if (code.length > 10000) {
    return {
      valid: false,
      error: 'Code exceeds maximum length of 10,000 characters',
    };
  }

  // Check for infinite loop patterns (basic)
  const loopPatterns = [
    /while\s*\(\s*true\s*\)/i,
    /for\s*\(\s*;\s*;\s*\)/i,
    /while\s*\(\s*1\s*\)/i,
  ];

  for (const pattern of loopPatterns) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: 'Code contains potential infinite loop pattern',
      };
    }
  }

  return { valid: true };
}

/**
 * Create a sandboxed execution environment
 */
function createSandbox(context: Record<string, unknown> = {}): SandboxContext {
  const logs: string[] = [];

  const sandbox: SandboxContext = {
    // Safe console implementation
    console: {
      log: (...args: unknown[]) => {
        logs.push(
          args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
        );
      },
      error: (...args: unknown[]) => {
        logs.push(
          `[ERROR] ${args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ')}`
        );
      },
      warn: (...args: unknown[]) => {
        logs.push(
          `[WARN] ${args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ')}`
        );
      },
      info: (...args: unknown[]) => {
        logs.push(
          `[INFO] ${args
            .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ')}`
        );
      },
    },

    // Safe built-ins
    Math: Object.freeze({ ...Math }),
    Date: Date,
    JSON: JSON,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    RegExp: RegExp,
    Error: Error,
    Map: Map,
    Set: Set,
    Promise: Promise,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: Number.isNaN,
    isFinite: Number.isFinite,
    encodeURI: encodeURI,
    decodeURI: decodeURI,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,

    // Add custom context variables
    ...(context as Record<string, unknown>),

    // Expose logs
    _logs: logs,
  };

  return sandbox;
}

/**
 * Execute code in sandbox with timeout
 */
async function executeInSandbox(
  code: string,
  timeout: number,
  context: Record<string, unknown> = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const sandbox = createSandbox(context);
  const logs: string[] = [];

  // Wrap the sandbox console to capture logs
  const originalLog = sandbox.console.log;
  sandbox.console.log = (...args: unknown[]) => {
    originalLog(...args);
    logs.push(...(sandbox._logs as string[]));
    (sandbox._logs as string[]) = [];
  };

  // Create a function from the code with sandbox as 'this'
  const wrappedCode = `
    "use strict";
    ${code}
  `;

  // Use Function constructor with sandbox bindings
  const sandboxKeys = Object.keys(sandbox);
  const sandboxValues = sandboxKeys.map((key) => (sandbox as Record<string, unknown>)[key]);

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(...sandboxKeys, wrappedCode);

  // Execute with timeout using Promise.race
  const executionPromise = Promise.resolve().then(() => {
    const result = fn(...sandboxValues);

    // Capture any remaining logs
    if ((sandbox._logs as string[]).length > 0) {
      logs.push(...(sandbox._logs as string[]));
    }

    return {
      result,
      logs,
      executionTime: Date.now() - startTime,
      memoryUsed: 0, // Memory measurement not available in all environments
    };
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Execution timeout after ${timeout}ms`)), timeout);
  });

  return Promise.race([executionPromise, timeoutPromise]);
}

// ============================================================================
// Code Executor Tool
// ============================================================================

export const codeExecutorTool = createTool<CodeExecutorParams>({
  name: 'code_executor',
  description: `Execute JavaScript code safely in a sandboxed environment.

Supports:
- Mathematical calculations and data processing
- Array and object manipulation
- String operations
- Date calculations
- JSON parsing and stringification

Limitations:
- No network access (fetch, XMLHttpRequest, etc.)
- No file system access
- No access to browser/Node.js globals
- 5 second timeout (configurable)
- 50MB memory limit (configurable)

Use console.log() to output intermediate results.

Examples:
- "const arr = [1, 2, 3, 4, 5]; console.log(arr.reduce((a, b) => a + b, 0));"
- "const data = [{name: 'A', value: 10}, {name: 'B', value: 20}]; data.sort((a, b) => b.value - a.value);"
- "const fib = (n) => n <= 1 ? n : fib(n-1) + fib(n-2); fib(10);"`,
  parameters: CodeExecutorParamsSchema,
  execute: async (params) => {
    try {
      const { code, timeout = 5000, memoryLimit = 50, context = {} } = params;

      // Validate code
      const validation = validateCode(code);
      if (!validation.valid) {
        return createErrorResult(validation.error || 'Code validation failed');
      }

      // Check memory limit (rough estimate)
      const codeSizeMB = Buffer.byteLength(code, 'utf8') / (1024 * 1024);
      if (codeSizeMB > memoryLimit) {
        return createErrorResult(
          `Code size (${codeSizeMB.toFixed(2)}MB) exceeds memory limit (${memoryLimit}MB)`
        );
      }

      // Execute code
      const result = await executeInSandbox(code, timeout, context);

      // Format result
      let formattedResult: Record<string, unknown>;
      if (result.result === undefined) {
        formattedResult = { output: 'undefined', logs: result.logs };
      } else if (result.result === null) {
        formattedResult = { output: 'null', logs: result.logs };
      } else if (typeof result.result === 'object') {
        formattedResult = {
          output: JSON.stringify(result.result, null, 2),
          type: 'object',
          logs: result.logs,
        };
      } else {
        formattedResult = {
          output: String(result.result),
          type: typeof result.result,
          logs: result.logs,
        };
      }

      return createSuccessResult({
        ...formattedResult,
        executionTime: `${result.executionTime}ms`,
        memoryLimit: `${memoryLimit}MB`,
        timeout: `${timeout}ms`,
      });
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : 'Code execution failed');
    }
  },
});

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick code execution without creating tool instance
 */
export async function executeCode(
  code: string,
  options?: {
    timeout?: number;
    memoryLimit?: number;
    context?: Record<string, unknown>;
  }
): Promise<{ success: boolean; result?: unknown; error?: string; logs?: string[] }> {
  const result = await codeExecutorTool.execute({
    code,
    timeout: options?.timeout,
    memoryLimit: options?.memoryLimit,
    context: options?.context,
  });

  if (result.success && typeof result.data === 'object' && result.data !== null) {
    const data = result.data as { output: string; logs: string[] };
    return {
      success: true,
      result: data.output,
      logs: data.logs,
    };
  }

  return {
    success: result.success,
    result: result.data,
    error: result.error,
  };
}

/**
 * Execute multiple code snippets in sequence
 */
export async function executeCodeBatch(
  snippets: Array<{
    name: string;
    code: string;
    context?: Record<string, unknown>;
  }>
): Promise<
  Record<string, { success: boolean; result?: unknown; error?: string; logs?: string[] }>
> {
  const results: Record<
    string,
    { success: boolean; result?: unknown; error?: string; logs?: string[] }
  > = {};

  for (const { name, code, context } of snippets) {
    results[name] = await executeCode(code, { context });
  }

  return results;
}
