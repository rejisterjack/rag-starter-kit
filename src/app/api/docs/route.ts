import { NextResponse } from 'next/server';

/**
 * API Documentation - OpenAPI 3.0 Specification
 *
 * Serves the OpenAPI spec for the RAG Starter Kit API.
 * Access at: /api/docs
 */

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'RAG Starter Kit API',
    description:
      'Production-ready RAG (Retrieval-Augmented Generation) chatbot API. Supports document ingestion, vector search, streaming chat, and workspace management.',
    version: '1.0.0',
    license: {
      name: 'MIT',
      url: 'https://github.com/rejisterjack/rag-starter-kit/blob/main/LICENSE',
    },
    contact: {
      name: 'RAG Starter Kit',
      url: 'https://github.com/rejisterjack/rag-starter-kit',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Current environment',
    },
  ],
  security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health Check',
        description: 'Returns the health status of the application and its dependencies.',
        tags: ['System'],
        security: [],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string', example: '1.0.0' },
                    uptime: { type: 'number', description: 'Uptime in seconds' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/chat': {
      post: {
        summary: 'Send Chat Message',
        description:
          'Send a message to the RAG chatbot. Returns a streaming response with source citations.',
        tags: ['Chat'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                        content: { type: 'string' },
                      },
                    },
                  },
                  conversationId: { type: 'string', description: 'Existing conversation ID' },
                  model: { type: 'string', description: 'LLM model override' },
                  workspaceId: { type: 'string', description: 'Workspace context for retrieval' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Streaming response with AI-generated tokens',
            content: {
              'text/event-stream': {
                schema: { type: 'string', description: 'Server-Sent Events stream' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/ingest': {
      post: {
        summary: 'Ingest Document',
        description:
          'Upload and ingest a document into the knowledge base. Supports PDF, DOCX, TXT, MD, and URLs.',
        tags: ['Documents'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Document file' },
                  url: { type: 'string', format: 'uri', description: 'URL to ingest' },
                  workspaceId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Document accepted for processing',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string', enum: ['PENDING', 'PROCESSING'] },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '413': {
            description: 'File too large',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/documents': {
      get: {
        summary: 'List Documents',
        description: 'List all documents in the current workspace.',
        tags: ['Documents'],
        parameters: [
          {
            name: 'workspaceId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'cursor',
            in: 'query',
            schema: { type: 'string', description: 'Cursor for pagination' },
          },
        ],
        responses: {
          '200': {
            description: 'List of documents',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    documents: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Document' },
                    },
                    nextCursor: { type: 'string', nullable: true },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/workspaces': {
      get: {
        summary: 'List Workspaces',
        description: 'List all workspaces the authenticated user has access to.',
        tags: ['Workspaces'],
        responses: {
          '200': {
            description: 'List of workspaces',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workspaces: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Workspace' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create Workspace',
        description: 'Create a new workspace.',
        tags: ['Workspaces'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Workspace created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Workspace' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'NextAuth.js session token',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Workspace API key for programmatic access',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object', nullable: true },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          contentType: { type: 'string' },
          size: { type: 'integer' },
          status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
          chunkCount: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Workspace: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          memberCount: { type: 'integer' },
          documentCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          },
        },
      },
      BadRequest: {
        description: 'Invalid request body',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Validation failed', code: 'VALIDATION_ERROR' },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        headers: {
          'Retry-After': {
            schema: { type: 'integer' },
            description: 'Seconds until rate limit resets',
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Rate limit exceeded', code: 'RATE_LIMIT' },
          },
        },
      },
    },
  },
  tags: [
    { name: 'System', description: 'Health and system endpoints' },
    { name: 'Chat', description: 'RAG-powered chat endpoints' },
    { name: 'Documents', description: 'Document ingestion and management' },
    { name: 'Workspaces', description: 'Workspace management' },
  ],
};

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
