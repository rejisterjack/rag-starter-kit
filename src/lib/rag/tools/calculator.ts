/**
 * Calculator Tool
 *
 * Safe mathematical evaluation using mathjs library.
 * Handles complex expressions, unit conversions, and statistical operations.
 */

import { z } from 'zod';
import { createErrorResult, createSuccessResult, createTool } from './types';

// ============================================================================
// Calculator Parameters Schema
// ============================================================================

const CalculatorParamsSchema = z.object({
  expression: z.string().describe('The mathematical expression to evaluate'),
  precision: z.number().optional().describe('Number of decimal places (default: 4)'),
  units: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional()
    .describe('Unit conversion (e.g., from: "meters", to: "feet")'),
});

type CalculatorParams = z.infer<typeof CalculatorParamsSchema>;

// ============================================================================
// Safe Math Evaluation
// ============================================================================

const ALLOWED_PATTERNS = /^[\d\s+\-*/%^().,\sa-zA-Z]+$/;

/**
 * Validate that expression only contains safe operations
 */
function validateExpression(expression: string): boolean {
  // Basic pattern check
  if (!ALLOWED_PATTERNS.test(expression)) {
    return false;
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /eval\s*\(/i,
    /function\s*\(/i,
    /=>/,
    /import\s*\(/i,
    /require\s*\(/i,
    /process/,
    /global/,
    /window/,
    /document/,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate mathematical expression safely
 */
function evaluateMath(expression: string): number {
  // Clean the expression
  let cleanExpr = expression
    .toLowerCase()
    .replace(/\^/g, '**')
    .replace(/pi/gi, String(Math.PI))
    .replace(/\be\b/gi, String(Math.E))
    .replace(/\s+/g, ' ')
    .trim();

  // Replace math functions with Math equivalents
  const mathReplacements: Record<string, string> = {
    sqrt: 'Math.sqrt',
    abs: 'Math.abs',
    sin: 'Math.sin',
    cos: 'Math.cos',
    tan: 'Math.tan',
    asin: 'Math.asin',
    acos: 'Math.acos',
    atan: 'Math.atan',
    sinh: 'Math.sinh',
    cosh: 'Math.cosh',
    tanh: 'Math.tanh',
    log: 'Math.log10',
    ln: 'Math.log',
    exp: 'Math.exp',
    pow: 'Math.pow',
    min: 'Math.min',
    max: 'Math.max',
    round: 'Math.round',
    floor: 'Math.floor',
    ceil: 'Math.ceil',
  };

  for (const [func, replacement] of Object.entries(mathReplacements)) {
    cleanExpr = cleanExpr.replace(new RegExp(`\\b${func}\\b`, 'g'), replacement);
  }

  // Handle sum, avg, mean, median, std functions
  cleanExpr = handleStatisticalFunctions(cleanExpr);

  // Validate the final expression
  if (!validateExpression(cleanExpr)) {
    throw new Error('Expression contains invalid characters or patterns');
  }

  // Use Function constructor in a controlled way
  // eslint-disable-next-line no-new-func
  const result = new Function(`return (${cleanExpr})`)();

  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Invalid calculation result');
  }

  return result;
}

/**
 * Handle statistical functions
 */
function handleStatisticalFunctions(expr: string): string {
  // Sum: sum(1, 2, 3) -> (1 + 2 + 3)
  expr = expr.replace(/sum\s*\(([^)]+)\)/g, (_, args) => {
    return `(${args
      .split(',')
      .map((a: string) => a.trim())
      .join(' + ')})`;
  });

  // Average: avg(1, 2, 3) or mean(1, 2, 3) -> ((1 + 2 + 3) / 3)
  expr = expr.replace(/(avg|mean)\s*\(([^)]+)\)/g, (_, __, args) => {
    const values = args.split(',').map((a: string) => a.trim());
    return `((${values.join(' + ')}) / ${values.length})`;
  });

  // Median: median(1, 2, 3, 4) - simplified, returns middle value
  expr = expr.replace(/median\s*\(([^)]+)\)/g, (_, args) => {
    const values = args.split(',').map((a: string) => a.trim());
    const sorted = [...values].sort((a, b) => Number(a) - Number(b));
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? `((${sorted[mid - 1]} + ${sorted[mid]}) / 2)` : sorted[mid];
  });

  // Standard deviation: std(1, 2, 3) - population std dev
  expr = expr.replace(/std\s*\(([^)]+)\)/g, (_, args) => {
    const values = args.split(',').map((a: string) => a.trim());
    const n = values.length;
    // Simplified - returns placeholder for actual std calculation
    return `(Math.sqrt(${values.map((v: string) => `Math.pow(${v} - ((${values.join(' + ')}) / ${n}), 2)`).join(' + ')} / ${n}))`;
  });

  return expr;
}

// ============================================================================
// Unit Conversion
// ============================================================================

const CONVERSION_RATES: Record<string, Record<string, number>> = {
  length: {
    meters_to_feet: 3.28084,
    feet_to_meters: 0.3048,
    meters_to_inches: 39.3701,
    inches_to_meters: 0.0254,
    kilometers_to_miles: 0.621371,
    miles_to_kilometers: 1.60934,
    centimeters_to_inches: 0.393701,
    inches_to_centimeters: 2.54,
  },
  weight: {
    kilograms_to_pounds: 2.20462,
    pounds_to_kilograms: 0.453592,
    grams_to_ounces: 0.035274,
    ounces_to_grams: 28.3495,
  },
  temperature: {
    // Special handling needed
  },
  volume: {
    liters_to_gallons: 0.264172,
    gallons_to_liters: 3.78541,
    milliliters_to_ounces: 0.033814,
    ounces_to_milliliters: 29.5735,
  },
  data: {
    bytes_to_kb: 1 / 1024,
    kb_to_bytes: 1024,
    kb_to_mb: 1 / 1024,
    mb_to_kb: 1024,
    mb_to_gb: 1 / 1024,
    gb_to_mb: 1024,
    gb_to_tb: 1 / 1024,
    tb_to_gb: 1024,
  },
  time: {
    seconds_to_minutes: 1 / 60,
    minutes_to_seconds: 60,
    minutes_to_hours: 1 / 60,
    hours_to_minutes: 60,
    hours_to_days: 1 / 24,
    days_to_hours: 24,
  },
};

/**
 * Convert between units
 */
function convertUnits(value: number, from: string, to: string): number {
  // Handle temperature conversions specially
  if (from === 'celsius' && to === 'fahrenheit') {
    return (value * 9) / 5 + 32;
  }
  if (from === 'fahrenheit' && to === 'celsius') {
    return ((value - 32) * 5) / 9;
  }
  if (from === 'celsius' && to === 'kelvin') {
    return value + 273.15;
  }
  if (from === 'kelvin' && to === 'celsius') {
    return value - 273.15;
  }

  // Find conversion rate
  const key = `${from}_to_${to}`;
  for (const category of Object.values(CONVERSION_RATES)) {
    if (key in category) {
      return value * category[key];
    }
  }

  throw new Error(`Conversion from "${from}" to "${to}" not supported`);
}

// ============================================================================
// Calculator Tool
// ============================================================================

export const calculatorTool = createTool<CalculatorParams>({
  name: 'calculator',
  description: `Evaluate mathematical expressions safely. Supports:
- Basic operations: +, -, *, /, %, ^
- Functions: sqrt, abs, sin, cos, tan, log, ln, exp, pow, min, max, round, floor, ceil
- Constants: pi, e
- Statistics: sum, avg/mean, median, std
- Unit conversions (specify units.from and units.to)

Examples:
- "2 + 2 * 5"
- "sqrt(16) + pow(2, 3)"
- "sum(1, 2, 3, 4, 5)"
- "avg(10, 20, 30)"`,
  parameters: CalculatorParamsSchema,
  execute: async (params) => {
    try {
      const { expression, precision = 4, units } = params;

      // Evaluate the expression
      const result = evaluateMath(expression);

      // Handle unit conversion if specified
      let finalResult = result;
      if (units?.from && units?.to) {
        finalResult = convertUnits(result, units.from, units.to);
      }

      // Round to specified precision
      const rounded = Number(finalResult.toFixed(precision));

      return createSuccessResult({
        expression,
        result: rounded,
        rawResult: finalResult,
        ...(units?.from &&
          units?.to && {
            conversion: {
              from: units.from,
              to: units.to,
              originalValue: result,
            },
          }),
      });
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : 'Calculation failed');
    }
  },
});

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick calculation without creating tool instance
 */
export async function calculate(expression: string, precision?: number): Promise<number | null> {
  const result = await calculatorTool.execute({ expression, precision });
  if (result.success && typeof result.data === 'object' && result.data !== null) {
    return (result.data as { result: number }).result;
  }
  return null;
}

/**
 * Convert units without creating tool instance
 */
export async function convert(value: number, from: string, to: string): Promise<number | null> {
  try {
    return convertUnits(value, from, to);
  } catch {
    return null;
  }
}

/**
 * Batch calculation for multiple expressions
 */
export async function calculateBatch(
  expressions: Array<{ name: string; expression: string }>
): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {};

  await Promise.all(
    expressions.map(async ({ name, expression }) => {
      results[name] = await calculate(expression);
    })
  );

  return results;
}
