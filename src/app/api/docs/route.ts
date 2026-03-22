import { NextResponse } from 'next/server';

/**
 * OpenAPI Specification for RAG Starter Kit API
 * GET /api/docs - Returns OpenAPI 3.0 spec
 */

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'RAG Starter Kit API',
    description: 'Production-ready RAG (Retrieval-Augmented Generation) chatbot API',
    version: '1.0.0',
    contact: {
      name: 'RAG Starter Kit Team',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  paths: {
    '/chat': {
      post: {
        summary: 'Send a chat message',
        description: 'Process a chat message with RAG context and return a streaming or non-streaming response',
        tags: ['Chat'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
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
                  chatId: { type: 'string' },
                  stream: { type: 'boolean', default: true },
                },
                required: ['messages'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Streaming response',
            content: {
              'text/event-stream': {
                schema: { type: 'string' },
              },
            },
          },
          '201': {
            description: 'Non-streaming response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        content: { type: 'string' },
                        sources: { type: 'array' },
                        usage: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      get: {
        summary: 'Get chat history',
        description: 'Retrieve message history for a conversation',
        tags: ['Chat'],
        parameters: [
          {
            name: 'chatId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Chat history',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        messages: { type: 'array' },
                        count: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Delete a chat',
        description: 'Delete a chat and all its messages',
        tags: ['Chat'],
        parameters: [
          {
            name: 'chatId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Chat deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/ingest': {
      post: {
        summary: 'Upload a document',
        description: 'Upload and queue a document for processing',
        tags: ['Ingestion'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  workspaceId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Document uploaded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        document: { type: 'object' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Check API and dependency health status',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    checks: { type: 'array' },
                    system: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/workspaces': {
      get: {
        summary: 'List workspaces',
        description: 'Get all workspaces for the authenticated user',
        tags: ['Workspaces'],
        responses: {
          '200': {
            description: 'List of workspaces',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create workspace',
        description: 'Create a new workspace',
        tags: ['Workspaces'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Workspace created',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

export async function GET() {
  return NextResponse.json(openApiSpec);
}

export const dynamic = 'force-dynamic';
