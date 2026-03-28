/**
 * Error Codes
 *
 * Standardized error codes for the application.
 * These are used for consistent error identification across
 * frontend, backend, and logging systems.
 */

// ============================================================================
// Authentication & Authorization Errors (AUTH_*)
// ============================================================================

export const AUTH_ERRORS = {
  /** Invalid credentials provided */
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  /** Session expired or invalid */
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  /** User not authenticated */
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  /** User lacks required permissions */
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  /** OAuth provider error */
  AUTH_OAUTH_ERROR: 'AUTH_OAUTH_ERROR',
  /** SSO configuration error */
  AUTH_SSO_ERROR: 'AUTH_SSO_ERROR',
  /** Account locked due to failed attempts */
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  /** Email not verified */
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  /** Invalid or expired token */
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
} as const;

// ============================================================================
// Validation Errors (VALIDATION_*)
// ============================================================================

export const VALIDATION_ERRORS = {
  /** Generic validation failure */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Invalid input provided */
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  /** Required field missing */
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  /** Invalid email format */
  VALIDATION_EMAIL: 'VALIDATION_EMAIL',
  /** Invalid URL format */
  VALIDATION_URL: 'VALIDATION_URL',
  /** String too short */
  VALIDATION_TOO_SHORT: 'VALIDATION_TOO_SHORT',
  /** String too long */
  VALIDATION_TOO_LONG: 'VALIDATION_TOO_LONG',
  /** Invalid file type */
  VALIDATION_FILE_TYPE: 'VALIDATION_FILE_TYPE',
  /** File too large */
  VALIDATION_FILE_SIZE: 'VALIDATION_FILE_SIZE',
  /** Invalid JSON format */
  VALIDATION_JSON: 'VALIDATION_JSON',
  /** Rate limit exceeded */
  VALIDATION_RATE_LIMIT: 'VALIDATION_RATE_LIMIT',
  /** Duplicate entry */
  VALIDATION_DUPLICATE: 'VALIDATION_DUPLICATE',
} as const;

// ============================================================================
// Rate Limiting Errors (RATE_LIMIT_*)
// ============================================================================

export const RATE_LIMIT_ERRORS = {
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// ============================================================================
// API & Server Errors (API_*)
// ============================================================================

export const API_ERRORS = {
  /** Generic API error */
  API_ERROR: 'API_ERROR',
  /** Resource not found */
  API_NOT_FOUND: 'API_NOT_FOUND',
  /** Method not allowed */
  API_METHOD_NOT_ALLOWED: 'API_METHOD_NOT_ALLOWED',
  /** Conflict with existing resource */
  API_CONFLICT: 'API_CONFLICT',
  /** Internal server error */
  API_INTERNAL_ERROR: 'API_INTERNAL_ERROR',
  /** Service temporarily unavailable */
  API_SERVICE_UNAVAILABLE: 'API_SERVICE_UNAVAILABLE',
  /** Gateway timeout */
  API_GATEWAY_TIMEOUT: 'API_GATEWAY_TIMEOUT',
  /** Bad request */
  API_BAD_REQUEST: 'API_BAD_REQUEST',
  /** System error */
  API_SYSTEM_ERROR: 'API_SYSTEM_ERROR',
  /** Unknown error */
  API_UNKNOWN_ERROR: 'API_UNKNOWN_ERROR',
} as const;

// ============================================================================
// RAG & AI Errors (RAG_*)
// ============================================================================

export const RAG_ERRORS = {
  /** Generic RAG error */
  RAG_ERROR: 'RAG_ERROR',
  /** Vector search failed */
  RAG_VECTOR_SEARCH: 'RAG_VECTOR_SEARCH',
  /** Embedding generation failed */
  RAG_EMBEDDING: 'RAG_EMBEDDING',
  /** LLM generation failed */
  RAG_LLM_ERROR: 'RAG_LLM_ERROR',
  /** No relevant documents found */
  RAG_NO_RESULTS: 'RAG_NO_RESULTS',
  /** Document processing failed */
  RAG_DOCUMENT_PROCESSING: 'RAG_DOCUMENT_PROCESSING',
  /** Context window exceeded */
  RAG_CONTEXT_LIMIT: 'RAG_CONTEXT_LIMIT',
  /** Query too complex */
  RAG_QUERY_COMPLEXITY: 'RAG_QUERY_COMPLEXITY',
} as const;

// ============================================================================
// Document & File Errors (DOC_*)
// ============================================================================

export const DOCUMENT_ERRORS = {
  /** Generic document error */
  DOC_ERROR: 'DOC_ERROR',
  /** Unsupported file format */
  DOC_UNSUPPORTED_FORMAT: 'DOC_UNSUPPORTED_FORMAT',
  /** File upload failed */
  DOC_UPLOAD_FAILED: 'DOC_UPLOAD_FAILED',
  /** File download failed */
  DOC_DOWNLOAD_FAILED: 'DOC_DOWNLOAD_FAILED',
  /** PDF processing error */
  DOC_PDF_ERROR: 'DOC_PDF_ERROR',
  /** OCR processing error */
  DOC_OCR_ERROR: 'DOC_OCR_ERROR',
  /** Document not found */
  DOC_NOT_FOUND: 'DOC_NOT_FOUND',
  /** Storage quota exceeded */
  DOC_QUOTA_EXCEEDED: 'DOC_QUOTA_EXCEEDED',
} as const;

/** @deprecated Use DOCUMENT_ERRORS.DOC_NOT_FOUND instead */
export const DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND';

// ============================================================================
// Database Errors (DB_*)
// ============================================================================

export const DATABASE_ERRORS = {
  /** Generic database error */
  DB_ERROR: 'DB_ERROR',
  /** Connection failed */
  DB_CONNECTION: 'DB_CONNECTION',
  /** Query failed */
  DB_QUERY: 'DB_QUERY',
  /** Transaction failed */
  DB_TRANSACTION: 'DB_TRANSACTION',
  /** Unique constraint violation */
  DB_UNIQUE_VIOLATION: 'DB_UNIQUE_VIOLATION',
  /** Foreign key constraint violation */
  DB_FOREIGN_KEY: 'DB_FOREIGN_KEY',
  /** Record not found */
  DB_NOT_FOUND: 'DB_NOT_FOUND',
  /** Database timeout */
  DB_TIMEOUT: 'DB_TIMEOUT',
} as const;

// ============================================================================
// External Service Errors (EXT_*)
// ============================================================================

export const EXTERNAL_ERRORS = {
  /** Generic external service error */
  EXT_ERROR: 'EXT_ERROR',
  /** OpenAI API error */
  EXT_OPENAI: 'EXT_OPENAI',
  /** Google AI API error */
  EXT_GOOGLE_AI: 'EXT_GOOGLE_AI',
  /** OpenRouter API error */
  EXT_OPENROUTER: 'EXT_OPENROUTER',
  /** Storage service error */
  EXT_STORAGE: 'EXT_STORAGE',
  /** Email service error */
  EXT_EMAIL: 'EXT_EMAIL',
  /** Webhook delivery failed */
  EXT_WEBHOOK: 'EXT_WEBHOOK',
} as const;

// ============================================================================
// All Error Codes Combined
// ============================================================================

export const ERROR_CODES = {
  ...AUTH_ERRORS,
  ...VALIDATION_ERRORS,
  ...RATE_LIMIT_ERRORS,
  ...API_ERRORS,
  ...RAG_ERRORS,
  ...DOCUMENT_ERRORS,
  ...DATABASE_ERRORS,
  ...EXTERNAL_ERRORS,
  DOCUMENT_NOT_FOUND,
} as const;

/** Type for all error codes */
export type ErrorCode = keyof typeof ERROR_CODES;

/** Get error category from code */
export function getErrorCategory(code: string): string {
  if (code.startsWith('AUTH_')) return 'authentication';
  if (code.startsWith('VALIDATION_')) return 'validation';
  if (code.startsWith('RATE_LIMIT_')) return 'rate_limit';
  if (code.startsWith('API_')) return 'api';
  if (code.startsWith('RAG_')) return 'rag';
  if (code.startsWith('DOC_')) return 'document';
  if (code.startsWith('DB_')) return 'database';
  if (code.startsWith('EXT_')) return 'external';
  return 'unknown';
}

/** Check if error code is retryable */
export function isRetryableError(code: string): boolean {
  const retryableCodes: string[] = [
    API_ERRORS.API_SERVICE_UNAVAILABLE,
    API_ERRORS.API_GATEWAY_TIMEOUT,
    API_ERRORS.API_INTERNAL_ERROR,
    EXTERNAL_ERRORS.EXT_ERROR,
    EXTERNAL_ERRORS.EXT_OPENAI,
    EXTERNAL_ERRORS.EXT_OPENROUTER,
    DATABASE_ERRORS.DB_CONNECTION,
    RAG_ERRORS.RAG_LLM_ERROR,
    RAG_ERRORS.RAG_EMBEDDING,
  ];
  return retryableCodes.includes(code);
}
