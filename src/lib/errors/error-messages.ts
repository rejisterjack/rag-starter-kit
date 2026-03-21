/**
 * Error Messages
 *
 * User-friendly error messages with i18n support.
 * Messages are organized by error category and provide
 * actionable suggestions when applicable.
 */

import { ERROR_CODES, type ErrorCode } from './error-codes';

// ============================================================================
// Error Message Interface
// ============================================================================

export interface ErrorMessage {
  /** User-friendly error message */
  message: string;
  /** Detailed description of the error */
  description: string;
  /** Suggested action to resolve the error */
  action: string;
  /** Whether the user can retry the operation */
  retryable: boolean;
  /** HTTP status code (for API errors) */
  statusCode?: number;
}

// ============================================================================
// Error Message Translations (English - Default)
// ============================================================================

const EN_ERROR_MESSAGES: Record<ErrorCode, ErrorMessage> = {
  // Authentication Errors
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: {
    message: 'Invalid email or password',
    description: 'The credentials you provided do not match our records.',
    action: 'Please check your email and password and try again.',
    retryable: true,
    statusCode: 401,
  },
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: {
    message: 'Session expired',
    description: 'Your session has expired for security reasons.',
    action: 'Please sign in again to continue.',
    retryable: true,
    statusCode: 401,
  },
  [ERROR_CODES.AUTH_UNAUTHORIZED]: {
    message: 'Sign in required',
    description: 'You need to be signed in to access this resource.',
    action: 'Please sign in and try again.',
    retryable: true,
    statusCode: 401,
  },
  [ERROR_CODES.AUTH_FORBIDDEN]: {
    message: 'Access denied',
    description: 'You do not have permission to perform this action.',
    action: 'Contact your administrator if you believe this is an error.',
    retryable: false,
    statusCode: 403,
  },
  [ERROR_CODES.AUTH_OAUTH_ERROR]: {
    message: 'Authentication failed',
    description: 'Unable to sign in with the selected provider.',
    action: 'Please try again or use a different sign-in method.',
    retryable: true,
    statusCode: 401,
  },
  [ERROR_CODES.AUTH_SSO_ERROR]: {
    message: 'SSO authentication failed',
    description: 'Unable to sign in with single sign-on.',
    action: 'Please contact your IT administrator for assistance.',
    retryable: true,
    statusCode: 401,
  },
  [ERROR_CODES.AUTH_ACCOUNT_LOCKED]: {
    message: 'Account temporarily locked',
    description: 'Your account has been locked due to too many failed sign-in attempts.',
    action: 'Please try again in 30 minutes or reset your password.',
    retryable: true,
    statusCode: 403,
  },
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]: {
    message: 'Email not verified',
    description: 'Your email address has not been verified.',
    action: 'Please check your inbox for a verification email.',
    retryable: false,
    statusCode: 403,
  },
  [ERROR_CODES.AUTH_INVALID_TOKEN]: {
    message: 'Invalid or expired link',
    description: 'The link you clicked is invalid or has expired.',
    action: 'Please request a new link and try again.',
    retryable: true,
    statusCode: 401,
  },

  // Validation Errors
  [ERROR_CODES.VALIDATION_ERROR]: {
    message: 'Invalid input',
    description: 'The information you provided is not valid.',
    action: 'Please check your input and try again.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_REQUIRED]: {
    message: 'Required field missing',
    description: 'A required field is missing or empty.',
    action: 'Please fill in all required fields and try again.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_EMAIL]: {
    message: 'Invalid email address',
    description: 'The email address format is not valid.',
    action: 'Please enter a valid email address (e.g., user@example.com).',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_URL]: {
    message: 'Invalid URL',
    description: 'The URL format is not valid.',
    action: 'Please enter a valid URL (e.g., https://example.com).',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_TOO_SHORT]: {
    message: 'Input too short',
    description: 'The input does not meet the minimum length requirement.',
    action: 'Please enter more characters and try again.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_TOO_LONG]: {
    message: 'Input too long',
    description: 'The input exceeds the maximum length allowed.',
    action: 'Please shorten your input and try again.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_FILE_TYPE]: {
    message: 'Unsupported file type',
    description: 'The file type you uploaded is not supported.',
    action: 'Please upload a supported file format.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_FILE_SIZE]: {
    message: 'File too large',
    description: 'The file size exceeds the maximum allowed limit.',
    action: 'Please upload a smaller file or compress it.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_JSON]: {
    message: 'Invalid JSON',
    description: 'The data format is not valid JSON.',
    action: 'Please check the data format and try again.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.VALIDATION_RATE_LIMIT]: {
    message: 'Too many requests',
    description: 'You have made too many requests in a short time.',
    action: 'Please wait a moment and try again.',
    retryable: true,
    statusCode: 429,
  },

  // API Errors
  [ERROR_CODES.API_ERROR]: {
    message: 'Something went wrong',
    description: 'An unexpected error occurred.',
    action: 'Please try again. If the problem persists, contact support.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.API_NOT_FOUND]: {
    message: 'Page not found',
    description: 'The resource you are looking for does not exist.',
    action: 'Please check the URL or navigate to a different page.',
    retryable: false,
    statusCode: 404,
  },
  [ERROR_CODES.API_METHOD_NOT_ALLOWED]: {
    message: 'Method not allowed',
    description: 'This action is not supported for the requested resource.',
    action: 'Please try a different action.',
    retryable: false,
    statusCode: 405,
  },
  [ERROR_CODES.API_CONFLICT]: {
    message: 'Resource already exists',
    description: 'A resource with this information already exists.',
    action: 'Please use different information or update the existing resource.',
    retryable: true,
    statusCode: 409,
  },
  [ERROR_CODES.API_INTERNAL_ERROR]: {
    message: 'Internal server error',
    description: 'Something went wrong on our end.',
    action: 'Please try again in a few moments.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.API_SERVICE_UNAVAILABLE]: {
    message: 'Service temporarily unavailable',
    description: 'The service is currently undergoing maintenance.',
    action: 'Please try again in a few minutes.',
    retryable: true,
    statusCode: 503,
  },
  [ERROR_CODES.API_GATEWAY_TIMEOUT]: {
    message: 'Request timeout',
    description: 'The request took too long to complete.',
    action: 'Please try again. The server may be busy.',
    retryable: true,
    statusCode: 504,
  },
  [ERROR_CODES.API_BAD_REQUEST]: {
    message: 'Bad request',
    description: 'The request could not be understood.',
    action: 'Please check your request and try again.',
    retryable: true,
    statusCode: 400,
  },

  // RAG Errors
  [ERROR_CODES.RAG_ERROR]: {
    message: 'AI processing error',
    description: 'An error occurred while processing your query.',
    action: 'Please try again with a different query.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.RAG_VECTOR_SEARCH]: {
    message: 'Search error',
    description: 'Unable to search your documents.',
    action: 'Please try again in a moment.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.RAG_EMBEDDING]: {
    message: 'Text processing error',
    description: 'Unable to process your text for search.',
    action: 'Please try again with different text.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.RAG_LLM_ERROR]: {
    message: 'AI generation error',
    description: 'The AI model encountered an error.',
    action: 'Please try again. The AI service may be temporarily unavailable.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.RAG_NO_RESULTS]: {
    message: 'No relevant documents found',
    description: 'Could not find any documents matching your query.',
    action: 'Try rephrasing your question or upload relevant documents.',
    retryable: true,
    statusCode: 404,
  },
  [ERROR_CODES.RAG_DOCUMENT_PROCESSING]: {
    message: 'Document processing error',
    description: 'Unable to process the uploaded document.',
    action: 'Please check the file format and try again.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.RAG_CONTEXT_LIMIT]: {
    message: 'Query too complex',
    description: 'Your query requires too much context to process.',
    action: 'Please try a more specific or shorter query.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.RAG_QUERY_COMPLEXITY]: {
    message: 'Query too complex',
    description: 'Your query is too complex for the AI to process.',
    action: 'Please break it down into simpler questions.',
    retryable: true,
    statusCode: 400,
  },

  // Document Errors
  [ERROR_CODES.DOC_ERROR]: {
    message: 'Document error',
    description: 'An error occurred while processing the document.',
    action: 'Please try again or contact support.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.DOC_UNSUPPORTED_FORMAT]: {
    message: 'Unsupported file format',
    description: 'The file type is not supported.',
    action: 'Please upload a supported file (PDF, DOCX, TXT, etc.).',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.DOC_UPLOAD_FAILED]: {
    message: 'Upload failed',
    description: 'Unable to upload the file.',
    action: 'Please check your connection and try again.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.DOC_DOWNLOAD_FAILED]: {
    message: 'Download failed',
    description: 'Unable to download the file.',
    action: 'Please try again or contact support.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.DOC_PDF_ERROR]: {
    message: 'PDF processing error',
    description: 'Unable to process the PDF file.',
    action: 'Please ensure the PDF is not corrupted or password-protected.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.DOC_OCR_ERROR]: {
    message: 'Text extraction error',
    description: 'Unable to extract text from the document.',
    action: 'Please try a clearer scan or different file format.',
    retryable: true,
    statusCode: 400,
  },
  [ERROR_CODES.DOC_NOT_FOUND]: {
    message: 'Document not found',
    description: 'The requested document could not be found.',
    action: 'Please check the document ID and try again.',
    retryable: false,
    statusCode: 404,
  },
  [ERROR_CODES.DOC_QUOTA_EXCEEDED]: {
    message: 'Storage limit reached',
    description: 'You have reached your storage quota.',
    action: 'Please delete some documents or upgrade your plan.',
    retryable: false,
    statusCode: 403,
  },

  // Database Errors
  [ERROR_CODES.DB_ERROR]: {
    message: 'Database error',
    description: 'An error occurred while accessing the database.',
    action: 'Please try again in a moment.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.DB_CONNECTION]: {
    message: 'Connection error',
    description: 'Unable to connect to the database.',
    action: 'Please try again in a few moments.',
    retryable: true,
    statusCode: 503,
  },
  [ERROR_CODES.DB_QUERY]: {
    message: 'Query error',
    description: 'Unable to execute the database query.',
    action: 'Please try again or contact support.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.DB_TRANSACTION]: {
    message: 'Transaction failed',
    description: 'The operation could not be completed.',
    action: 'Please try again.',
    retryable: true,
    statusCode: 500,
  },
  [ERROR_CODES.DB_UNIQUE_VIOLATION]: {
    message: 'Already exists',
    description: 'A record with this information already exists.',
    action: 'Please use different information.',
    retryable: true,
    statusCode: 409,
  },
  [ERROR_CODES.DB_FOREIGN_KEY]: {
    message: 'Reference error',
    description: 'This operation would break existing references.',
    action: 'Please check dependencies before proceeding.',
    retryable: false,
    statusCode: 409,
  },
  [ERROR_CODES.DB_NOT_FOUND]: {
    message: 'Record not found',
    description: 'The requested record does not exist.',
    action: 'Please check the ID and try again.',
    retryable: false,
    statusCode: 404,
  },

  // External Service Errors
  [ERROR_CODES.EXT_ERROR]: {
    message: 'External service error',
    description: 'An external service encountered an error.',
    action: 'Please try again in a moment.',
    retryable: true,
    statusCode: 502,
  },
  [ERROR_CODES.EXT_OPENAI]: {
    message: 'AI service error',
    description: 'The AI service is temporarily unavailable.',
    action: 'Please try again in a few moments.',
    retryable: true,
    statusCode: 502,
  },
  [ERROR_CODES.EXT_GOOGLE_AI]: {
    message: 'AI service error',
    description: 'The Google AI service is temporarily unavailable.',
    action: 'Please try again in a few moments.',
    retryable: true,
    statusCode: 502,
  },
  [ERROR_CODES.EXT_OPENROUTER]: {
    message: 'AI service error',
    description: 'The AI routing service is temporarily unavailable.',
    action: 'Please try again in a few moments.',
    retryable: true,
    statusCode: 502,
  },
  [ERROR_CODES.EXT_STORAGE]: {
    message: 'Storage service error',
    description: 'Unable to access the storage service.',
    action: 'Please try again in a moment.',
    retryable: true,
    statusCode: 502,
  },
  [ERROR_CODES.EXT_EMAIL]: {
    message: 'Email service error',
    description: 'Unable to send email.',
    action: 'Please try again or contact support.',
    retryable: true,
    statusCode: 502,
  },
  [ERROR_CODES.EXT_WEBHOOK]: {
    message: 'Webhook error',
    description: 'Unable to deliver webhook notification.',
    action: 'Please check the webhook URL and try again.',
    retryable: true,
    statusCode: 502,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get error message for a given error code
 */
export function getErrorMessage(code: ErrorCode | string): ErrorMessage {
  const message = EN_ERROR_MESSAGES[code as ErrorCode];
  if (message) {
    return message;
  }

  // Fallback for unknown error codes
  return {
    message: 'Something went wrong',
    description: 'An unexpected error occurred.',
    action: 'Please try again. If the problem persists, contact support.',
    retryable: true,
    statusCode: 500,
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode | string,
  details?: string
): {
  error: string;
  code: string;
  details?: string;
  action: string;
  retryable: boolean;
} {
  const message = getErrorMessage(code);
  return {
    error: message.message,
    code,
    ...(details && { details }),
    action: message.action,
    retryable: message.retryable,
  };
}

/**
 * Get HTTP status code for an error
 */
export function getErrorStatusCode(code: ErrorCode | string): number {
  const message = getErrorMessage(code);
  return message.statusCode ?? 500;
}
