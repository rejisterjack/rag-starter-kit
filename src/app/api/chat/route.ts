/**
 * Chat API Route with Streaming Support
 * Handles chat messages with RAG context and streaming responses
 *
 * Security Features:
 * - Authentication check
 * - Workspace access validation
 * - Rate limiting
 * - Input validation
 * - Audit logging
 */

import { type LanguageModel, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { createProviderFromEnv, type LLMMessage } from '@/lib/ai/llm';
import { buildSystemPromptWithContext } from '@/lib/ai/prompts/templates';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CitationHandler, sourcesToChunks } from '@/lib/rag/citations';
import { ConversationMemory } from '@/lib/rag/memory';
import { retrieveSources } from '@/lib/rag/retrieval';
import { estimateMessageTokens } from '@/lib/rag/token-budget';
import { validateChatInput } from '@/lib/security/input-validator';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import type { RAGConfig } from '@/types';

// =============================================================================
// Configuration
// =============================================================================

const defaultConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-small',
};

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'chat', {
      userId,
      workspaceId,
      endpoint: '/api/chat',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          resetAt: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Step 3: Validate workspace access
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'chat',
            requiredPermission: Permission.READ_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { error: 'Access denied to workspace', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Step 4: Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Step 5: Validate input
    let validatedInput: ReturnType<typeof validateChatInput>;
    try {
      validatedInput = validateChatInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: 'Validation failed', code: 'VALIDATION_ERROR', details: error.message },
          { status: 400 }
        );
      }
      throw error;
    }

    const {
      messages,
      chatId,
      conversationId,
      config: userConfig,
      stream: shouldStream,
    } = validatedInput;
    const config = { ...defaultConfig, ...userConfig };
    const effectiveConversationId = conversationId ?? chatId;
    const userMessage = messages[messages.length - 1].content;

    // Step 6: Get conversation history
    const memory = new ConversationMemory(prisma);
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (effectiveConversationId) {
      // Verify user has access to this conversation
      const chat = await prisma.chat.findFirst({
        where: {
          id: effectiveConversationId,
          OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
        },
      });

      if (!chat) {
        return NextResponse.json({ error: 'Chat not found', code: 'NOT_FOUND' }, { status: 404 });
      }

      const recentMessages = await memory.getRecentMessages(effectiveConversationId, 10);
      history = recentMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
    }

    // Step 7: Retrieve relevant sources
    const sources = await retrieveSources(userMessage, userId, config);

    // Step 8: Build context with citations
    const citationHandler = new CitationHandler();
    const chunks = sourcesToChunks(sources);
    const { context, citationMap } = citationHandler.formatContextWithCitations(chunks);

    // Step 9: Build system prompt
    const systemPrompt = buildSystemPromptWithContext(context, {
      style: config.temperature < 0.5 ? 'concise' : 'balanced',
    });

    // Step 10: Prepare messages for LLM
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    // Step 10b: Estimate token usage for budget tracking
    const estimatedTokens = estimateMessageTokens(llmMessages);
    if (estimatedTokens > config.maxTokens * 2) {
      return NextResponse.json(
        {
          error: 'Message too long',
          code: 'TOKEN_LIMIT',
          details: `Estimated tokens (${estimatedTokens}) exceeds limit (${config.maxTokens * 2})`,
        },
        { status: 400 }
      );
    }

    // Step 11: Save user message to database
    if (effectiveConversationId) {
      await memory.addMessage(effectiveConversationId, {
        role: 'user',
        content: userMessage,
      });
    }

    // Step 12: Log chat message
    await logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      userId,
      workspaceId,
      metadata: {
        chatId: effectiveConversationId,
        messageLength: userMessage.length,
        hasContext: sources.length > 0,
        sourceCount: sources.length,
        model: config.model,
      },
    });

    // Step 13: Initialize LLM provider
    const llmProvider = createProviderFromEnv();

    if (shouldStream) {
      // Streaming response
      const result = streamText({
        model: getModel(config.model),
        messages: llmMessages,
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        onFinish: async (completion) => {
          // Save assistant response to database
          if (effectiveConversationId) {
            await memory.addMessage(effectiveConversationId, {
              role: 'assistant',
              content: completion.text,
            });
          }

          // Log token usage
          if (completion.usage) {
            await prisma.apiUsage.create({
              data: {
                userId,
                workspaceId,
                endpoint: '/api/chat',
                method: 'POST',
                tokensPrompt: completion.usage.inputTokens ?? 0,
                tokensCompletion: completion.usage.outputTokens ?? 0,
                tokensTotal:
                  (completion.usage.inputTokens ?? 0) + (completion.usage.outputTokens ?? 0),
                latencyMs: Date.now() - startTime,
              },
            });
          }
        },
      });

      // Prepare source metadata for headers
      const sourcesMetadata = sources.map((s) => ({
        id: s.id,
        documentName: s.metadata.documentName,
        documentId: s.metadata.documentId,
        page: s.metadata.page,
        similarity: s.similarity,
      }));

      const response = result.toTextStreamResponse({
        headers: {
          'X-Message-Sources': JSON.stringify(sourcesMetadata),
          'X-Model-Used': config.model,
        },
      });

      // Add rate limit headers
      addRateLimitHeaders(response.headers, rateLimitResult);

      return response;
    } else {
      // Non-streaming response
      const response = await llmProvider.generate(llmMessages, {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

      // Extract citations
      const citations = citationHandler.extractCitations(response.content, citationMap);

      // Save assistant response
      if (effectiveConversationId) {
        await memory.addMessage(effectiveConversationId, {
          role: 'assistant',
          content: response.content,
          sources: citations.map((c) => ({
            id: c.chunkId,
            content: c.content,
            similarity: c.score,
            metadata: {
              documentId: c.documentId,
              documentName: c.documentName,
              page: c.page,
              chunkIndex: 0,
              totalChunks: 0,
            },
          })),
          tokensUsed: {
            prompt: response.usage.promptTokens,
            completion: response.usage.completionTokens,
            total: response.usage.totalTokens,
          },
        });
      }

      // Log token usage
      await prisma.apiUsage.create({
        data: {
          userId,
          workspaceId,
          endpoint: '/api/chat',
          method: 'POST',
          tokensPrompt: response.usage.promptTokens,
          tokensCompletion: response.usage.completionTokens,
          tokensTotal: response.usage.totalTokens,
          latencyMs: Date.now() - startTime,
        },
      });

      const jsonResponse = NextResponse.json({
        success: true,
        data: {
          content: response.content,
          sources: citations.map((c) => ({
            id: c.id,
            documentName: c.documentName,
            documentId: c.documentId,
            page: c.page,
            score: c.score,
          })),
          usage: response.usage,
          model: response.model,
        },
      });

      // Add rate limit headers
      addRateLimitHeaders(jsonResponse.headers, rateLimitResult);

      return jsonResponse;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode =
      error instanceof Error && 'code' in error
        ? getErrorStatusCode((error as { code: string }).code)
        : 500;

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        code: 'INTERNAL_ERROR',
        details: errorMessage,
      },
      { status: statusCode }
    );
  }
}

// =============================================================================
// GET Handler - Get chat history
// =============================================================================

export async function GET(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const effectiveId = chatId ?? conversationId;

    if (!effectiveId) {
      return NextResponse.json(
        { error: 'chatId or conversationId is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: effectiveId,
        OR: [{ userId }, { workspaceId: session.user.workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memory = new ConversationMemory(prisma);
    const messages = await memory.getHistory(effectiveId, limit);

    return NextResponse.json({
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          sources: m.sources,
        })),
        count: messages.length,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to retrieve chat history', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE Handler - Delete chat
// =============================================================================

export async function DELETE(req: Request) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    // Verify user has access to delete this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId }, workspaceId ? { workspaceId } : {}],
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Check delete permission for workspace chats
    if (chat.workspaceId && chat.userId !== userId) {
      const canDelete = await checkPermission(userId, chat.workspaceId, Permission.DELETE_CHATS);
      if (!canDelete) {
        return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
      }
    }

    // Delete chat (cascade will handle messages)
    await prisma.chat.delete({
      where: { id: chatId },
    });

    // Log deletion
    await logAuditEvent({
      event: AuditEvent.CHAT_DELETED,
      userId,
      workspaceId: chat.workspaceId ?? undefined,
      metadata: { chatId },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Chat deleted successfully' },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to delete chat', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

import { openai } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider';

/**
 * Get the appropriate model based on configuration
 */
function getModel(modelName: string): LanguageModel {
  // Check if it's an OpenAI model
  if (modelName.startsWith('gpt-') || modelName.startsWith('text-')) {
    return openai(modelName) as unknown as LanguageModel;
  }

  // Check if it's an Ollama model
  const ollamaModels = ['llama3', 'mistral', 'phi3', 'gemma2', 'codellama'];
  if (ollamaModels.some((m) => modelName.startsWith(m))) {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
    });
    return ollama(modelName) as unknown as LanguageModel;
  }

  // Default to OpenAI
  return openai(modelName) as unknown as LanguageModel;
}

/**
 * Map error codes to HTTP status codes
 */
function getErrorStatusCode(code: string): number {
  const statusMap: Record<string, number> = {
    RATE_LIMIT: 429,
    MODEL_UNAVAILABLE: 503,
    CONTEXT_LENGTH_EXCEEDED: 413,
    UNAUTHORIZED: 401,
    CONFIG_ERROR: 500,
    UNKNOWN_PROVIDER: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
  };

  return statusMap[code] ?? 500;
}
