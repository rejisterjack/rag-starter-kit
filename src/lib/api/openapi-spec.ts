/**
 * OpenAPI Specification
 *
 * Complete OpenAPI 3.1.0 specification for the RAG Starter Kit API.
 * Provides documentation for all endpoints with proper schemas.
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'RAG Starter Kit API',
    description:
      'Production-ready RAG (Retrieval-Augmented Generation) API with enterprise-grade features',
    version: '1.0.0',
    contact: {
      name: 'API Support',
      email: 'api@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Base API path',
    },
  ],

  // =============================================================================
  // Security
  // =============================================================================
  security: [{ bearerAuth: [] }, { apiKey: [] }],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from NextAuth session',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for programmatic access',
      },
    },

    // =============================================================================
    // Schemas
    // =============================================================================
    schemas: {
      // Error schemas
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'AUTH_UNAUTHORIZED' },
              message: { type: 'string', example: 'Authentication required' },
              details: { type: 'object' },
              requestId: { type: 'string', format: 'uuid' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },

      ValidationError: {
        allOf: [
          { $ref: '#/components/schemas/Error' },
          {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  details: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    example: { email: 'Invalid email format' },
                  },
                },
              },
            },
          },
        ],
      },

      // Message schemas
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          metadata: {
            type: 'object',
            properties: {
              tokensUsed: { type: 'integer' },
              latency: { type: 'integer', description: 'Response latency in ms' },
              model: { type: 'string' },
            },
          },
          sources: {
            type: 'array',
            items: { $ref: '#/components/schemas/Source' },
          },
        },
        required: ['id', 'role', 'content', 'createdAt'],
      },

      Source: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          metadata: {
            type: 'object',
            properties: {
              documentId: { type: 'string' },
              documentName: { type: 'string' },
              page: { type: 'integer' },
              chunkIndex: { type: 'integer' },
            },
          },
        },
        required: ['id', 'content', 'score'],
      },

      // Document schemas
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['pdf', 'docx', 'txt', 'md', 'html', 'url'] },
          size: { type: 'integer', description: 'File size in bytes' },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'error'],
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          metadata: {
            type: 'object',
            properties: {
              pageCount: { type: 'integer' },
              chunkCount: { type: 'integer' },
              language: { type: 'string' },
            },
          },
        },
        required: ['id', 'name', 'type', 'status', 'createdAt'],
      },

      // Workspace schemas
      Workspace: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          ownerId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          settings: {
            type: 'object',
            properties: {
              defaultModel: { type: 'string' },
              maxTokens: { type: 'integer' },
              allowPublicSharing: { type: 'boolean' },
            },
          },
        },
        required: ['id', 'name', 'slug', 'ownerId', 'createdAt'],
      },

      // API Key schemas
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          keyPrefix: { type: 'string', example: 'rag_abc...' },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            example: ['read:documents', 'write:chats'],
          },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'keyPrefix', 'permissions', 'createdAt'],
      },

      // Chat request/response schemas
      ChatRequest: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            minLength: 1,
            maxLength: 10000,
            description: 'User message content',
          },
          conversationId: {
            type: 'string',
            format: 'uuid',
            description: 'Optional conversation ID for continuing a chat',
          },
          model: {
            type: 'string',
            description: 'Model to use for generation',
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
            default: 0.7,
          },
          stream: {
            type: 'boolean',
            default: true,
            description: 'Whether to stream the response',
          },
          options: {
            type: 'object',
            properties: {
              useRag: { type: 'boolean', default: true },
              topK: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
              similarityThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
            },
          },
        },
        required: ['message'],
      },

      ChatResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              message: { $ref: '#/components/schemas/Message' },
              conversationId: { type: 'string', format: 'uuid' },
              tokensUsed: {
                type: 'object',
                properties: {
                  prompt: { type: 'integer' },
                  completion: { type: 'integer' },
                  total: { type: 'integer' },
                },
              },
              latency: { type: 'integer', description: 'Total latency in ms' },
            },
          },
        },
        required: ['success', 'data'],
      },

      // Pagination schemas
      CursorPagination: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          pagination: {
            type: 'object',
            properties: {
              hasNextPage: { type: 'boolean' },
              hasPreviousPage: { type: 'boolean' },
              nextCursor: { type: 'string', nullable: true },
              previousCursor: { type: 'string', nullable: true },
              totalCount: { type: 'integer', nullable: true },
            },
            required: ['hasNextPage', 'hasPreviousPage', 'nextCursor', 'previousCursor'],
          },
        },
        required: ['items', 'pagination'],
      },

      // Rate limit headers
      RateLimitHeaders: {
        type: 'object',
        description: 'Rate limit information in response headers',
        properties: {
          'X-RateLimit-Limit': {
            type: 'integer',
            description: 'Maximum requests allowed in the window',
          },
          'X-RateLimit-Remaining': {
            type: 'integer',
            description: 'Remaining requests in current window',
          },
          'X-RateLimit-Reset': {
            type: 'string',
            format: 'date-time',
            description: 'When the rate limit window resets',
          },
        },
      },
    },

    // =============================================================================
    // Parameters
    // =============================================================================
    parameters: {
      CursorParam: {
        name: 'cursor',
        in: 'query',
        description: 'Cursor for pagination',
        schema: { type: 'string' },
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page (max 100)',
        schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
      },
      WorkspaceIdParam: {
        name: 'workspaceId',
        in: 'path',
        required: true,
        description: 'Workspace ID',
        schema: { type: 'string', format: 'uuid' },
      },
    },

    // =============================================================================
    // Responses
    // =============================================================================
    responses: {
      UnauthorizedError: {
        description: 'Unauthorized - Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'AUTH_UNAUTHORIZED',
                message: 'Authentication required',
                requestId: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
      },

      ForbiddenError: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'AUTH_FORBIDDEN',
                message: 'Insufficient permissions for this action',
                requestId: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
      },

      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationError' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_INVALID_INPUT',
                message: 'Validation failed',
                details: {
                  email: 'Invalid email format',
                  password: 'Password must be at least 8 characters',
                },
                requestId: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
      },

      RateLimitError: {
        description: 'Rate limit exceeded',
        headers: {
          'Retry-After': {
            description: 'Seconds until rate limit resets',
            schema: { type: 'integer' },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Rate limit exceeded. Please try again later.',
                requestId: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
      },

      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'DOCUMENT_NOT_FOUND',
                message: 'Document not found',
                requestId: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
      },
    },
  },

  // =============================================================================
  // Paths
  // =============================================================================
  paths: {
    // Health check
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Check API health status',
        security: [],
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Chat endpoints
    '/chat': {
      post: {
        tags: ['Chat'],
        summary: 'Send chat message',
        description: 'Send a message and get AI response with optional RAG context',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatResponse' },
              },
              'text/event-stream': {
                schema: {
                  type: 'string',
                  description: 'Server-sent events for streaming responses',
                },
              },
            },
            headers: {
              'X-RateLimit-Limit': {
                $ref: '#/components/schemas/RateLimitHeaders/properties/X-RateLimit-Limit',
              },
              'X-RateLimit-Remaining': {
                $ref: '#/components/schemas/RateLimitHeaders/properties/X-RateLimit-Remaining',
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },

    // Document endpoints
    '/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List documents',
        description: 'Get paginated list of documents in workspace',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['pending', 'processing', 'completed', 'error'] },
          },
        ],
        responses: {
          '200': {
            description: 'List of documents',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/CursorPagination' },
                    {
                      properties: {
                        items: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Document' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },

      post: {
        tags: ['Documents'],
        summary: 'Upload document',
        description: 'Upload a document for processing and embedding',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Document file (PDF, DOCX, TXT, max 50MB)',
                  },
                  metadata: {
                    type: 'object',
                    description: 'Optional metadata for the document',
                  },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Document uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Document' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid file type or size',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '403': { $ref: '#/components/responses/ForbiddenError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },

    '/documents/{id}': {
      get: {
        tags: ['Documents'],
        summary: 'Get document',
        description: 'Get a single document by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Document details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Document' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },

      delete: {
        tags: ['Documents'],
        summary: 'Delete document',
        description: 'Delete a document and its embeddings',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': {
            description: 'Document deleted successfully',
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '403': { $ref: '#/components/responses/ForbiddenError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },

    // Workspace endpoints
    '/workspaces': {
      get: {
        tags: ['Workspaces'],
        summary: 'List workspaces',
        description: 'Get workspaces for the authenticated user',
        responses: {
          '200': {
            description: 'List of workspaces',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Workspace' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },

      post: {
        tags: ['Workspaces'],
        summary: 'Create workspace',
        description: 'Create a new workspace',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                  description: { type: 'string', maxLength: 500 },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Workspace created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Workspace' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },

    // API Key endpoints
    '/api-keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List API keys',
        description: 'Get API keys for the current workspace',
        responses: {
          '200': {
            description: 'List of API keys',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ApiKey' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },

      post: {
        tags: ['API Keys'],
        summary: 'Create API key',
        description: 'Create a new API key for programmatic access',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  permissions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of permission strings',
                  },
                  expiresInDays: { type: 'integer', minimum: 1, maximum: 365 },
                },
                required: ['name', 'permissions'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'API key created (key shown only once)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        apiKey: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            key: { type: 'string', description: 'Full API key (shown only once)' },
                            keyPrefix: { type: 'string' },
                            permissions: { type: 'array', items: { type: 'string' } },
                            createdAt: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '403': { $ref: '#/components/responses/ForbiddenError' },
        },
      },
    },
  },
} as const;

// =============================================================================
// Export for use in API documentation page
// =============================================================================

export type OpenAPISpec = typeof openApiSpec;

/**
 * Generate Swagger UI HTML
 */
export function generateSwaggerUIHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAG Starter Kit API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    #swagger-ui { max-width: 1460px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        spec: ${JSON.stringify(openApiSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.presets.standalone
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'BaseLayout',
        validatorUrl: null,
      });
    };
  </script>
</body>
</html>`;
}
