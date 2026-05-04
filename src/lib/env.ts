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

  // Optional AI provider keys
  FIREWORKS_API_KEY: z.string().optional(),

  // Optional variables with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().default(3000),

  // Redis configuration (optional — Upstash for production, in-memory fallback for dev)
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Storage configuration (Cloudinary for production, local filesystem fallback for dev)
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // CORS configuration
  ALLOWED_ORIGINS: z.string().optional(),

  // CSP configuration - additional connect-src domains
  CSP_CONNECT_SRC: z.string().optional(),

  // Logging configuration
  LOG_ENDPOINT: z.string().url().optional(),

  // External services
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),

  // Ollama configuration
  OLLAMA_BASE_URL: z.string().optional(),

  // Plausible analytics
  NEXT_PUBLIC_ANALYTICS_HOST: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_SCRIPT_URL: z.string().optional(),

  // Email (Resend for production, console fallback for dev)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Read replica (optional — falls back to primary DATABASE_URL)
  DATABASE_READ_REPLICA_URL: z.string().optional(),

  // Database pool sizing
  DB_POOL_MAX: z.coerce.number().optional(),

  // Encryption key for sensitive data at rest (min 32 chars)
  // Required in production for encrypting SAML keys, webhook secrets, etc.
  ENCRYPTION_MASTER_KEY: z
    .string()
    .min(
      32,
      'ENCRYPTION_MASTER_KEY must be at least 32 characters (generate: openssl rand -base64 32)'
    )
    .optional()
    .refine(
      (val) => process.env.NODE_ENV !== 'production' || (val !== undefined && val.length >= 32),
      { message: 'ENCRYPTION_MASTER_KEY is required in production' }
    ),

  // CSRF protection key (falls back to NEXTAUTH_SECRET if not set)
  CSRF_SECRET: z.string().min(32).optional(),

  // Stripe configuration
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
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
    throw new Error(
      'Environment validation failed. Check the console output above for missing or invalid variables.'
    );
  }
}

// =============================================================================
// Export validated env
// =============================================================================

export const env = validateEnv();

// Re-export for convenience
export type { EnvSchema };
