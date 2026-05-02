import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import { generateRAGResponse } from '@/lib/rag/engine';
import { validateApiKey } from '@/lib/security/api-keys';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// Request Validation Schema
// =============================================================================

const chatRequestSchema = z.object({
  question: z.string().min(1, 'Question is required').max(4000, 'Question too long'),
  workspaceId: z.string().optional(),
  conversationId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  config: z
    .object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
      topK: z.number().positive().optional(),
      similarityThreshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

// =============================================================================
// POST Handler - Chat with RAG
// =============================================================================

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate via API key
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Validate API key
    const keyValidation = await validateApiKey(apiKey, {
      requiredPermissions: [Permission.READ_CHATS, Permission.WRITE_CHATS],
    });

    if (!keyValidation.valid) {
      await logAuditEvent({
        event: AuditEvent.SUSPICIOUS_ACTIVITY,
        metadata: {
          activity: 'public_chat_invalid_api_key',
          error: keyValidation.error,
        },
        severity: 'WARNING',
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const workspaceId = keyValidation.workspaceId;
    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not associated with a workspace',
          code: 'WORKSPACE_REQUIRED',
        },
        { status: 403 }
      );
    }

    // Step 2: Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for public chat', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }

    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.issues.map((issue: z.ZodIssue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { question, history, config } = parseResult.data;

    // Step 3: Check workspace permissions
    const hasPermission = await checkPermission(
      keyValidation.keyId || '',
      workspaceId,
      Permission.READ_DOCUMENTS
    );

    if (!hasPermission) {
      await logAuditEvent({
        event: AuditEvent.PERMISSION_DENIED,
        workspaceId,
        metadata: {
          action: 'public_chat',
          requiredPermission: Permission.READ_DOCUMENTS,
        },
        severity: 'WARNING',
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to access workspace documents',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Step 4: Generate RAG response
    const ragResponse = await generateRAGResponse({
      query: question,
      userId: keyValidation.keyId,
      history,
      config: {
        ...config,
        model: config?.model || 'gpt-4o-mini',
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxTokens ?? 2000,
        topK: config?.topK ?? 5,
        similarityThreshold: config?.similarityThreshold ?? 0.7,
      },
    });

    // Step 5: Log successful request
    await logAuditEvent({
      event: AuditEvent.CHAT_CREATED,
      userId: keyValidation.keyId,
      workspaceId,
      metadata: {
        question: question.slice(0, 100), // Truncate for privacy
        tokensUsed: ragResponse.tokensUsed,
        latency: Date.now() - startTime,
        sourcesCount: ragResponse.sources.length,
      },
    });

    // Step 6: Return response
    return NextResponse.json({
      success: true,
      data: {
        answer: ragResponse.answer,
        citations: ragResponse.sources.map((source, index) => ({
          id: index + 1,
          documentId: source.metadata?.documentId,
          documentName: source.metadata?.documentName || 'Unknown Document',
          page: source.metadata?.page,
          score: source.similarity,
          content: source.content.slice(0, 200) + (source.content.length > 200 ? '...' : ''),
        })),
        metadata: {
          tokensUsed: ragResponse.tokensUsed,
          latency: Date.now() - startTime,
          sourceCount: ragResponse.sources.length,
          workspaceId,
        },
      },
    });
  } catch (error) {
    // Log error
    await logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      metadata: {
        endpoint: '/api/public/chat',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      severity: 'WARNING',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate response',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - API Info
// =============================================================================

export async function GET() {
  return NextResponse.json({
    name: 'RAG Starter Kit Public API',
    version: '1.0.0',
    endpoints: {
      'POST /api/public/chat': {
        description: 'Chat with your documents using RAG',
        authentication: 'API Key required (Bearer token or X-API-Key header)',
        requestBody: {
          question: 'string (required) - Your question',
          workspaceId: 'string (optional) - Override workspace',
          history: 'array (optional) - Previous messages',
          config: 'object (optional) - Model configuration',
        },
        response: {
          success: 'boolean',
          data: {
            answer: 'string - The AI response',
            citations: 'array - Source documents',
            metadata: 'object - Usage stats',
          },
        },
      },
    },
    documentation: 'https://docs.ragstarterkit.com/api',
  });
}

// =============================================================================
// OPTIONS Handler - CORS
// =============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
