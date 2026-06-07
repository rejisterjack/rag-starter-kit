/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at startup using Zod.
 * This ensures the application fails fast with clear error messages
 * rather than failing silently at runtime.
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// =============================================================================
// Environment Schema
// =============================================================================

const envSchema = z.object({
  // Required variables
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // NextAuth v5 uses AUTH_SECRET; NEXTAUTH_SECRET is the legacy name.
  // At least one must be set with 32+ characters.
  AUTH_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, 'GOOGLE_GENERATIVE_AI_API_KEY is required'),
  GROQ_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),

  // Optional variables with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().default(7392),

  NEXT_PUBLIC_APP_URL: z.string().url().optional().default('http://localhost:7392'),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_APP_VERSION: z.string().optional(),

  // Redis configuration
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Storage configuration (Cloudinary for production, local filesystem fallback for dev)
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().optional(),

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

  // Qdrant vector database
  QDRANT_URL: z
    .string()
    .url('QDRANT_URL must be a valid URL')
    .optional()
    .default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),

  // Embedding configuration — dimensions must match the Qdrant collection vector size.
  // Default: 768 (Google Gemini text-embedding-004).
  EMBEDDING_PROVIDER: z.enum(['google', 'openai', 'ollama']).default('google'),
  EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),

  // Plausible analytics
  NEXT_PUBLIC_ANALYTICS_HOST: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_SCRIPT_URL: z.string().optional(),

  // Email (Resend for production, console fallback for dev)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_TO_EMAIL: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // Error tracking (optional — Sentry free tier: 5K events/month)
  SENTRY_DSN: z.string().optional(),

  // Read replica (optional — falls back to primary DATABASE_URL)
  DATABASE_READ_REPLICA_URL: z.string().optional(),

  // Database pool sizing
  DB_POOL_MAX: z.coerce.number().optional(),

  // Encryption key for sensitive data at rest
  ENCRYPTION_MASTER_KEY: z.string().optional(),
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
    const parsed = envSchema.parse(process.env);

    // Cross-field validation: at least one auth secret must be 32+ chars
    const authSecret = parsed.AUTH_SECRET || parsed.NEXTAUTH_SECRET;
    if (!authSecret || authSecret.length < 32) {
      throw new Error(
        'AUTH_SECRET or NEXTAUTH_SECRET must be at least 32 characters. Generate: openssl rand -base64 32'
      );
    }

    // At least one URL must be set
    if (!parsed.AUTH_URL && !parsed.NEXTAUTH_URL) {
      throw new Error('AUTH_URL or NEXTAUTH_URL must be set to a valid URL');
    }

    // Production-only checks
    if (parsed.NODE_ENV === 'production') {
      if (!parsed.UPSTASH_REDIS_REST_URL) {
        throw new Error('UPSTASH_REDIS_REST_URL is required in production');
      }
      if (!parsed.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('UPSTASH_REDIS_REST_TOKEN is required in production');
      }
      if (!parsed.ENCRYPTION_MASTER_KEY || parsed.ENCRYPTION_MASTER_KEY.length < 32) {
        throw new Error(
          'ENCRYPTION_MASTER_KEY is required in production (min 32 chars). Generate: openssl rand -base64 32'
        );
      }
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Invalid environment variables:', {
        issues: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
    } else {
      logger.error('Failed to validate environment variables:', {
        error: error instanceof Error ? error.message : String(error),
      });
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
