import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { z } from 'zod';

import type { DocumentType } from '@/types';

// Initialize DOMPurify for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// =============================================================================
// Sanitization Helpers
// =============================================================================

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize HTML content using DOMPurify
 *
 * DOMPurify is a DOM-only, super-fast, uber-tolerant XSS sanitizer for HTML, MathML and SVG.
 * It uses the browser's DOM API to parse and sanitize HTML, making it more secure than regex-based approaches.
 *
 * Configuration:
 * - Allows only safe HTML tags and attributes
 * - Removes event handlers and javascript: URLs
 * - Strips out <script>, <style>, and other dangerous tags
 * - Prevents DOM Clobbering attacks
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return purify.sanitize(input, {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'a',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    SANITIZE_DOM: true,
  });
}

// =============================================================================
// Zod Schemas
// =============================================================================

// Chat input validation
export const chatInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(100000).transform(sanitizeString),
        id: z.string().optional(),
      })
    )
    .min(1)
    .max(50),
  chatId: z.string().cuid().optional(),
  conversationId: z.string().cuid().optional(),
  config: z
    .object({
      chunkSize: z.number().int().min(100).max(5000).optional(),
      chunkOverlap: z.number().int().min(0).max(1000).optional(),
      topK: z.number().int().min(1).max(20).optional(),
      similarityThreshold: z.number().min(0).max(1).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().min(1).max(8000).optional(),
      model: z.string().min(1).max(100).optional(),
      embeddingModel: z.string().min(1).max(100).optional(),
    })
    .optional(),
  stream: z.boolean().optional().default(true),
});

export type ChatInput = z.infer<typeof chatInputSchema>;

// Ingest input validation
export const ingestInputSchema = z.object({
  workspaceId: z.string().cuid().optional(),
  options: z
    .object({
      chunkSize: z.number().int().min(100).max(5000).optional(),
      chunkOverlap: z.number().int().min(0).max(1000).optional(),
      extractImages: z.boolean().optional(),
      preserveFormatting: z.boolean().optional(),
    })
    .optional(),
});

export type IngestInput = z.infer<typeof ingestInputSchema>;

// URL ingestion validation
export const urlIngestSchema = z.object({
  url: z.string().url().max(2000),
  workspaceId: z.string().cuid().optional(),
  options: z
    .object({
      maxDepth: z.number().int().min(0).max(3).optional().default(0),
      maxPages: z.number().int().min(1).max(10).optional().default(1),
      includeImages: z.boolean().optional().default(false),
    })
    .optional(),
});

export type UrlIngestInput = z.infer<typeof urlIngestSchema>;

// Workspace creation validation
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).transform(sanitizeString),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).transform(sanitizeString).optional(),
  avatar: z.string().url().max(500).optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

// Workspace settings schema (Fix #15)
export const workspaceSettingsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().max(10).optional(),
    defaultModel: z.string().max(100).optional(),
    ragConfig: z
      .object({
        chunkSize: z.number().int().min(100).max(5000).optional(),
        chunkOverlap: z.number().int().min(0).max(1000).optional(),
        topK: z.number().int().min(1).max(50).optional(),
        similarityThreshold: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .strict();

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

// Workspace update validation
export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).transform(sanitizeString).optional(),
  description: z.string().max(500).transform(sanitizeString).optional().nullable(),
  avatar: z.string().url().max(500).optional().nullable(),
  settings: workspaceSettingsSchema.optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// Member invitation validation
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// Member role update validation
export const updateMemberRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// API key creation validation
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100).transform(sanitizeString),
  permissions: z.array(z.string()).min(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  allowedIps: z
    .array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F:]{2,})$/))
    .max(10)
    .optional(),
  allowedEndpoints: z.array(z.string().max(200)).max(20).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// User registration validation with enhanced password policy
export const registerUserSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/^(?=.*\d)/, 'Password must contain at least one number')
    .regex(
      /^(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
      'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;\'":",.<>/?)'
    ),
  name: z.string().max(100).transform(sanitizeString).optional(),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

// Login validation
export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Password change validation with enhanced policy
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/^(?=.*\d)/, 'Password must contain at least one number')
    .regex(
      /^(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
      'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;\'":",.<>/?)'
    ),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Document search validation
export const documentSearchSchema = z.object({
  query: z.string().min(1).max(1000).transform(sanitizeString),
  workspaceId: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
  offset: z.number().int().min(0).optional().default(0),
});

export type DocumentSearchInput = z.infer<typeof documentSearchSchema>;

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().cuid(),
});

export type IdParamInput = z.infer<typeof idParamSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * Validate data against a schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Validate and throw on error
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Format Zod errors for API response
 */
export function formatValidationErrors(error: z.ZodError): Array<{
  path: string;
  message: string;
}> {
  return error.issues.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));
}

// =============================================================================
// Specific Validators
// =============================================================================

/**
 * Validate chat input
 */
export function validateChatInput(input: unknown): ChatInput {
  return validateOrThrow(chatInputSchema, input);
}

/**
 * Validate ingest input
 */
export function validateIngestInput(input: unknown): IngestInput {
  return validateOrThrow(ingestInputSchema, input);
}

/**
 * Validate URL ingest input
 */
export function validateUrlIngestInput(input: unknown): UrlIngestInput {
  return validateOrThrow(urlIngestSchema, input);
}

/**
 * Validate workspace creation input
 */
export function validateCreateWorkspaceInput(input: unknown): CreateWorkspaceInput {
  return validateOrThrow(createWorkspaceSchema, input);
}

/**
 * Validate user registration input
 */
export function validateRegisterUserInput(input: unknown): RegisterUserInput {
  return validateOrThrow(registerUserSchema, input);
}

/**
 * Validate login input
 */
export function validateLoginInput(input: unknown): LoginInput {
  return validateOrThrow(loginSchema, input);
}

// =============================================================================
// File Validation
// =============================================================================

const ALLOWED_MIME_TYPES: Record<DocumentType, string[]> = {
  PDF: ['application/pdf'],
  DOCX: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  XLSX: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  PPTX: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  TXT: ['text/plain'],
  MD: ['text/plain', 'text/markdown'],
  HTML: ['text/html', 'application/xhtml+xml'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface FileValidationResult {
  valid: boolean;
  type?: DocumentType;
  error?: string;
}

/**
 * Validate uploaded file
 */
export function validateFile(
  file: File,
  options?: {
    maxSize?: number;
    allowedTypes?: DocumentType[];
  }
): FileValidationResult {
  const maxSize = options?.maxSize ?? MAX_FILE_SIZE;
  const allowedTypes = options?.allowedTypes ?? (Object.keys(ALLOWED_MIME_TYPES) as DocumentType[]);

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${formatBytes(maxSize)} limit`,
    };
  }

  // Check file type
  for (const type of allowedTypes) {
    if (ALLOWED_MIME_TYPES[type].includes(file.type)) {
      return { valid: true, type };
    }
  }

  return {
    valid: false,
    error: `File type "${file.type}" is not supported. Allowed types: ${allowedTypes.join(', ')}`,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

// =============================================================================
// Magic Byte File Validation (Fix #8)
// =============================================================================

/**
 * Magic bytes for file type validation
 * Maps MIME types to their expected byte signatures
 */
const MAGIC_BYTES: Record<string, { bytes: number[]; offset: number }> = {
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }, // %PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    bytes: [0x50, 0x4b, 0x03, 0x04], // ZIP signature (DOCX is a ZIP archive)
    offset: 0,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    bytes: [0x50, 0x4b, 0x03, 0x04], // ZIP signature (XLSX is a ZIP archive)
    offset: 0,
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    bytes: [0x50, 0x4b, 0x03, 0x04], // ZIP signature (PPTX is a ZIP archive)
    offset: 0,
  },
  'text/html': { bytes: [0x3c], offset: 0 }, // < (less than sign)
};

export interface FileBytesValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file bytes using magic byte detection
 * This prevents renamed file attacks by checking the actual file content
 *
 * @param buffer - ArrayBuffer containing file data
 * @param expectedMime - Expected MIME type from file.type
 * @returns Validation result
 */
export function validateFileBytes(
  buffer: ArrayBuffer,
  expectedMime: string
): FileBytesValidationResult {
  // Text files have no reliable magic bytes, allow through
  if (expectedMime === 'text/plain' || expectedMime === 'text/markdown') {
    return { valid: true };
  }

  const magic = MAGIC_BYTES[expectedMime];
  if (!magic) {
    // Unknown file type, reject for security
    return {
      valid: false,
      error: `Unknown file type for magic byte validation: ${expectedMime}`,
    };
  }

  const view = new Uint8Array(buffer);

  // Check if buffer is large enough
  if (view.length < magic.offset + magic.bytes.length) {
    return {
      valid: false,
      error: 'File too small for magic byte validation',
    };
  }

  // Verify magic bytes match
  for (let i = 0; i < magic.bytes.length; i++) {
    if (view[magic.offset + i] !== magic.bytes[i]) {
      return {
        valid: false,
        error: `File content does not match expected type ${expectedMime}. Possible renamed file attack.`,
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// Email Validation
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

// =============================================================================
// URL Validation
// =============================================================================

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // Remove credentials from URL
    parsed.username = '';
    parsed.password = '';

    return parsed.toString();
  } catch {
    return null;
  }
}
