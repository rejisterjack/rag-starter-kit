/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at startup using Zod.
 * This ensures the application fails fast with clear error messages
 * rather than failing silently at runtime.
 */

import { z } from 'zod';

// =============================================================================
// Environment Schema
// =============================================================================

const envSchema = z.object({
  // Required variables
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters (generate: openssl rand -base64 32)'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  GOOGLE_API_KEY: z.string().min(1, 'GOOGLE_API_KEY is required'),

  // Optional variables with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Redis configuration (optional)
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Storage configuration (optional)
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // CORS configuration
  ALLOWED_ORIGINS: z.string().optional(),

  // Logging configuration
  LOG_ENDPOINT: z.string().url().optional(),

  // External services
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),

  // Ollama configuration
  OLLAMA_BASE_URL: z.string().optional(),

  // PostHog analytics
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),

  // Google embedding quota
  GOOGLE_EMBED_DAILY_LIMIT: z.coerce.number().default(1400),
});

// =============================================================================
// Type Definition
// =============================================================================

type EnvSchema = z.infer<typeof envSchema>;

// =============================================================================
// Validation
// =============================================================================

function validateEnv(): EnvSchema {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // biome-ignore lint/suspicious/noConsole: Intentional error logging at startup
      console.error('❌ Invalid environment variables:');
      for (const issue of error.issues) {
        // biome-ignore lint/suspicious/noConsole: Intentional error logging at startup
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      // biome-ignore lint/suspicious/noConsole: Intentional error logging at startup
      console.error('❌ Failed to validate environment variables:', error);
    }
    process.exit(1);
  }
}

// =============================================================================
// Export validated env
// =============================================================================

export const env = validateEnv();

// Re-export for convenience
export type { EnvSchema };
