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

import { generateText, type LanguageModel, streamText } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import type { LLMMessage } from '@/lib/ai/llm';
import {
  getBestAvailableModel,
  getModelsForStreaming,
  resolveModel as resolveDynamicModel,
} from '@/lib/ai/model-discovery';
import { modelHealthCache } from '@/lib/ai/model-health-cache';
import { buildSystemPromptWithContext } from '@/lib/ai/prompts/templates';
import { bufferUsageRecord } from '@/lib/analytics/usage-buffer';
import { checkBodySize } from '@/lib/api/middleware';
import { wrapStreamWithErrorFrame } from '@/lib/api/stream-error-wrapper';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import {
  ConcurrentModificationError,
  extractVersion,
  updateWithVersion,
} from '@/lib/db/optimistic-locking';
import { logger } from '@/lib/logger';
import {
  chatCreateSchema,
  chatUpdateSchema,
  validateChatInput,
} from '@/lib/security/input-validator';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// Lazy-loaded modules to reduce cold-start time.
// These are heavy and only needed inside the handler body.
async function loadModules() {
  const [
    degradationMod,
    memoryMod,
    retrievalMod,
    tracingMod,
    citationsMod,
    tokenBudgetMod,
    externalServicesMod,
  ] = await Promise.all([
    import('@/lib/resilience/degradation'),
    import('@/lib/rag/memory'),
    import('@/lib/rag/retrieval'),
    import('@/lib/tracing'),
    import('@/lib/rag/citations'),
    import('@/lib/rag/token-budget'),
    import('@/lib/resilience/external-services'),
  ]);
  return {
    degradationMod,
    memoryMod,
    retrievalMod,
    tracingMod,
    citationsMod,
    tokenBudgetMod,
    externalServicesMod,
  };
}

// =============================================================================
// Route Configuration
// =============================================================================

// Vercel maxDuration: streaming chat can run up to 120s
export const maxDuration = 120;

// =============================================================================
// Configuration
// =============================================================================

/** Timeout for AI calls — allows complex RAG responses while preventing hung connections */
const AI_CALL_TIMEOUT_MS = 60_000;
/** Timeout for model health probes — free-tier models can be slow to respond */
const PROBE_TIMEOUT_MS = 5_000;

const defaultConfig = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  chunkSize: 1000,
  chunkOverlap: 200,
  maxMessages: 10,
  topK: 5,
  similarityThreshold: 0.5,
  rerank: true,
};

// Patterns that strongly indicate a web search query (current events, real-time data).
const WEB_SEARCH_STRONG_PATTERNS = [
  /\b(latest|recent|current)\s+(news|events|developments|updates|headlines)\b/,
  /\bnews\s+(on|about|regarding)\b/,
  /\bwhat('s| is)\s+(happening|going on|trending)\b/,
  /\b(weather|temperature|forecast)\s+(in|at|for|like|today)\b/,
  /\b(stock\s*price|share\s*price|market\s*(cap|price))\b/,
  /\bcurrent\s+(events|affairs|situation|status|state)\b/,
  /\b(today|tonight|this\s+(week|month|year))\s*(('s|is)\s+)?(news|update|weather|event|game|match|score)\b/,
  /\b(breaking|live)\s+(news|update|coverage)\b/,
  /\bwho\s+(won|is\s+winning)\b/,
];

const DOCUMENT_SIGNAL_PATTERN =
  /\b(my\s+(document|file|report|paper|upload)|the\s+(uploaded|attached)\s+(file|document|report)|from\s+(my|the)\s+(document|file|report|paper|upload)|i\s+uploaded|we\s+uploaded)\b/i;

function isWebSearchQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();
  if (DOCUMENT_SIGNAL_PATTERN.test(lower)) return false;
  return WEB_SEARCH_STRONG_PATTERNS.some((p) => p.test(lower));
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Cold-start monitoring: track time from module load to first response
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.setTag('route', '/api/chat');
      Sentry.setTag('method', 'POST');
    } catch {
      // Sentry not available
    }
  }

  try {
    // Phase 1: Auth + heavy module loading in parallel
    const [session, mods] = await Promise.all([auth(), loadModules()]);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Phase 2: Rate limit + degradation + permission check in parallel
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const [rateLimitResult, isLlmDegraded, hasWorkspaceAccess] = await Promise.all([
      checkApiRateLimit(rateLimitIdentifier, 'chat', {
        userId,
        workspaceId,
        endpoint: '/api/chat',
      }),
      mods.degradationMod.isFeatureDegraded('llm_generation'),
      workspaceId
        ? checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS)
        : Promise.resolve(true),
    ]);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded',
            resetAt: new Date(rateLimitResult.reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    if (isLlmDegraded) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_DEGRADED',
            message: 'AI service temporarily unavailable. Please try again shortly.',
          },
        },
        { status: 503, headers: { 'X-Degraded-Features': 'llm_generation' } }
      );
    }

    if (!hasWorkspaceAccess) {
      logAuditEvent({
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } },
        { status: 403 }
      );
    }

    // Step 4: Parse and validate request body

    const bodySizeCheck = checkBodySize(req, 1_000_000);
    if (bodySizeCheck) return bodySizeCheck;

    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in chat request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
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
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: error.message,
            },
          },
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
    const { model: userModel, ...safeConfig } = userConfig ?? {};
    const config = { ...defaultConfig, ...safeConfig };
    const effectiveConversationId = conversationId ?? chatId;
    const userMessage = messages[messages.length - 1].content;

    // Step 5b: Detect web search queries that don't belong in RAG retrieval.
    // When the query is clearly about current events/real-time data, skip document
    // retrieval and respond from the model's general knowledge.
    const isWebQuery = isWebSearchQuery(userMessage);

    // Step 6+7: Fetch conversation history and retrieve sources in parallel.
    // Embedding generation is kicked off early and passed as precomputedEmbedding
    // to retrieveSources, avoiding sequential wait.
    const ConversationMemory = mods.memoryMod.ConversationMemory;
    const conversationMemory = new ConversationMemory(prismaRead);
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let sources: Awaited<ReturnType<typeof import('@/lib/rag/retrieval')['retrieveSources']>> = [];
    let vectorSearchDegraded = false;
    let retrievalError: string | null = null;

    // Short-circuit retrieval for trivial/conversational messages that don't need context.
    // Saves 150-500ms (embedding API + vector search) for ~15-25% of messages.
    const GREETING_PATTERN =
      /^(hi|hello|hey|thanks|thank you|ok|okay|got it|sounds good|great|cool|sure|yes|no|bye|goodbye|good morning|good evening|good afternoon)\b/i;
    const needsRetrieval =
      !isWebQuery && userMessage.length >= 10 && !GREETING_PATTERN.test(userMessage.trim());

    // Start embedding generation early (concurrent with history fetch)
    const embeddingPromise = needsRetrieval
      ? mods.retrievalMod.generateQueryEmbedding(userMessage).catch(() => null as number[] | null)
      : Promise.resolve(null as number[] | null);

    const [historyResult, retrievalResult] = await Promise.all([
      (async () => {
        if (!effectiveConversationId) return { history: [], chatNotFound: false };
        const chat = await prismaRead.chat.findFirst({
          where: {
            id: effectiveConversationId,
            OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
          },
        });
        if (!chat) return { history: [], chatNotFound: true };
        const recentMessages = await conversationMemory.getRecentMessages(
          effectiveConversationId,
          10
        );
        return {
          history: recentMessages
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          chatNotFound: false,
        };
      })(),
      (async () => {
        try {
          if (await mods.degradationMod.isFeatureDegraded('vector_search')) {
            return { sources: [], degraded: true, error: null };
          }
          // Fast-fail if Qdrant circuit breaker is OPEN
          const { qdrantCircuitBreaker } = mods.externalServicesMod;
          if (qdrantCircuitBreaker.getState() === 'OPEN') {
            return { sources: [], degraded: true, error: null };
          }
          const { withSpan } = mods.tracingMod;
          const precomputedEmbedding = await embeddingPromise;
          const s = await withSpan('chat.retrieve_sources', async (span) => {
            span.setAttribute('chat.query_length', userMessage.length);
            const result = await mods.retrievalMod.retrieveSources(userMessage, userId, {
              ...config,
              workspaceId,
              ...(precomputedEmbedding ? { precomputedEmbedding } : {}),
            });
            span.setAttribute('chat.sources_count', result.length);
            return result;
          });
          return { sources: s, degraded: false, error: null };
        } catch (err) {
          return {
            sources: [],
            degraded: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })(),
    ]);

    if (historyResult.chatNotFound) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
        { status: 404 }
      );
    }
    history = historyResult.history;
    sources = retrievalResult.sources;
    vectorSearchDegraded = retrievalResult.degraded;
    if (retrievalResult.error) {
      retrievalError = retrievalResult.error;
      logger.warn('Source retrieval failed, continuing without RAG context', {
        error: retrievalError,
      });
    }
    if (vectorSearchDegraded) {
      logger.info('Vector search degraded, skipping RAG retrieval');
    }

    // Step 8: Build context with citations
    const { CitationHandler, sourcesToChunks } = mods.citationsMod;
    const citationHandler = new CitationHandler();
    const chunks = sourcesToChunks(sources);
    const { context, citationMap } = citationHandler.formatContextWithCitations(chunks);

    // Step 9: Build system prompt
    let systemPrompt: string;
    if (isWebQuery) {
      systemPrompt =
        'You are a helpful assistant. The user is asking about current events or real-time information. ' +
        'Answer from your general knowledge and clearly state that your knowledge has a cutoff date. ' +
        'Suggest the user enable Agent Mode (toggle in the chat header) for live web search results.';
    } else {
      systemPrompt = buildSystemPromptWithContext(context, {
        style: config.temperature < 0.5 ? 'concise' : 'balanced',
      });
    }

    // Step 10: Prepare messages for LLM
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    // Step 10b: Estimate token usage for budget tracking
    const { estimateMessageTokens } = mods.tokenBudgetMod;
    const estimatedTokens = estimateMessageTokens(llmMessages);
    if (estimatedTokens > config.maxTokens * 2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_LIMIT',
            message: 'Message too long',
            details: `Estimated tokens (${estimatedTokens}) exceeds limit (${config.maxTokens * 2})`,
          },
        },
        { status: 400 }
      );
    }

    // Step 11: Save user message to database
    if (effectiveConversationId) {
      await conversationMemory.addMessage(effectiveConversationId, {
        role: 'user',
        content: userMessage,
      });
    }

    // Step 12: Log chat message (fire-and-forget)
    logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      userId,
      workspaceId,
      metadata: {
        chatId: effectiveConversationId,
        messageLength: userMessage.length,
        hasContext: sources.length > 0,
        sourceCount: sources.length,
      },
    });

    if (shouldStream) {
      // If user explicitly selected a model, use it directly (skip discovery + probe)
      if (userModel && userModel !== 'auto') {
        const usedModel = userModel;

        const resolvedModel = resolveDynamicModel(usedModel) ?? getModel(usedModel);

        let streamError: string | null = null;

        const result = streamText({
          model: resolvedModel,
          messages: llmMessages,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          abortSignal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
          onError: (error) => {
            streamError = error instanceof Error ? error.message : String(error);
            modelHealthCache.recordFailure(usedModel);
            logger.error('Stream error from user-selected model', {
              model: usedModel,
              error: streamError,
            });
          },
          onFinish: async (completion) => {
            try {
              modelHealthCache.recordSuccess(usedModel);
              if (effectiveConversationId) {
                await prisma.message.create({
                  data: {
                    chatId: effectiveConversationId,
                    content: completion.text,
                    role: 'ASSISTANT',
                  },
                });
                const { del } = await import('@/lib/cache');
                const { CACHE_KEYS } = await import('@/lib/cache/keys');
                for (const lim of [50, 100]) {
                  await del(CACHE_KEYS.chatHistory(effectiveConversationId, lim));
                }
              }
              if (completion.usage) {
                bufferUsageRecord({
                  userId,
                  workspaceId,
                  endpoint: '/api/chat',
                  method: 'POST',
                  tokensPrompt: completion.usage.promptTokens ?? 0,
                  tokensCompletion: completion.usage.completionTokens ?? 0,
                  tokensTotal:
                    (completion.usage.promptTokens ?? 0) + (completion.usage.completionTokens ?? 0),
                  latencyMs: Date.now() - startTime,
                });
              }
              if (effectiveConversationId) {
                await maybeGenerateTitle(
                  effectiveConversationId,
                  userMessage,
                  completion.text,
                  usedModel
                );
              }
            } catch (txError) {
              logger.warn('Transaction failed in streaming onFinish', {
                error: txError instanceof Error ? txError.message : String(txError),
              });
            }
          },
        });

        const sourcesMetadata = sources.map((s) => ({
          id: s.id,
          documentName: s.metadata.documentName,
          documentId: s.metadata.documentId,
          page: s.metadata.page,
          similarity: s.similarity,
        }));

        const rawResponse = result.toTextStreamResponse({
          headers: {
            'X-Message-Sources': JSON.stringify(sourcesMetadata),
            'X-Model-Used': usedModel,
            ...(isWebQuery ? { 'X-Strategy': 'web_query_no_rag' } : {}),
            'X-RAG-Status': isWebQuery
              ? 'skipped_web_query'
              : sources.length > 0
                ? 'hit'
                : retrievalError
                  ? 'error'
                  : vectorSearchDegraded
                    ? 'degraded'
                    : 'miss',
            ...(retrievalError ? { 'X-RAG-Error': retrievalError.slice(0, 200) } : {}),
            ...(vectorSearchDegraded ? { 'X-Degraded-Features': 'vector_search' } : {}),
          },
        });

        const response = wrapStreamWithErrorFrame(rawResponse, () => streamError);
        addRateLimitHeaders(response.headers, rateLimitResult);
        return response;
      }

      // Dynamic model discovery — finds best available models from OpenRouter
      const { modelsToTry: discoveredModels, primaryModel } = await getModelsForStreaming('chat');

      // If the circuit breaker is open, fail fast
      const { llmCircuitBreaker } = mods.externalServicesMod;
      if (llmCircuitBreaker.getState() === 'OPEN') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MODEL_UNAVAILABLE',
              message: 'AI service temporarily unavailable. Please try again in a moment.',
            },
          },
          { status: 503 }
        );
      }

      if (discoveredModels.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MODEL_UNAVAILABLE',
              message: 'All AI models are currently unavailable. Please try again in a moment.',
            },
          },
          { status: 503 }
        );
      }

      let usedModel = primaryModel;

      // Probe to find a working model when the primary isn't recently confirmed healthy.
      const skipProbe = modelHealthCache.isRecentlyHealthy(primaryModel);
      if (!skipProbe) {
        let foundWorking = false;
        for (const modelName of discoveredModels) {
          try {
            await llmCircuitBreaker.execute(async () => {
              await generateText({
                model: resolveDynamicModel(modelName) ?? getModel(modelName),
                messages: [{ role: 'user', content: 'hi' }],
                maxTokens: 1,
                abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
              });
            });
            usedModel = modelName;
            foundWorking = true;
            modelHealthCache.recordSuccess(modelName);
            break;
          } catch (err) {
            modelHealthCache.recordFailure(modelName);
            logger.warn(`Model ${modelName} probe failed, trying next`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (!foundWorking) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'MODEL_UNAVAILABLE',
                message: 'All AI models are currently unavailable. Please try again in a moment.',
              },
            },
            { status: 503 }
          );
        }
      }

      const resolvedModel = resolveDynamicModel(usedModel) ?? getModel(usedModel);

      let streamError: string | null = null;

      const result = streamText({
        model: resolvedModel,
        messages: llmMessages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        abortSignal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
        onError: (error) => {
          streamError = error instanceof Error ? error.message : String(error);
          modelHealthCache.recordFailure(usedModel);
          logger.error('Stream error from model', {
            model: usedModel,
            error: streamError,
          });
        },
        onFinish: async (completion) => {
          try {
            if (effectiveConversationId) {
              await prisma.message.create({
                data: {
                  chatId: effectiveConversationId,
                  content: completion.text,
                  role: 'ASSISTANT',
                },
              });
              // Invalidate chat history cache
              const { del } = await import('@/lib/cache');
              const { CACHE_KEYS } = await import('@/lib/cache/keys');
              for (const lim of [50, 100]) {
                await del(CACHE_KEYS.chatHistory(effectiveConversationId, lim));
              }
            }

            if (completion.usage) {
              bufferUsageRecord({
                userId,
                workspaceId,
                endpoint: '/api/chat',
                method: 'POST',
                tokensPrompt: completion.usage.promptTokens ?? 0,
                tokensCompletion: completion.usage.completionTokens ?? 0,
                tokensTotal:
                  (completion.usage.promptTokens ?? 0) + (completion.usage.completionTokens ?? 0),
                latencyMs: Date.now() - startTime,
              });
            }

            // Title generation is non-critical — run outside transaction
            if (effectiveConversationId) {
              await maybeGenerateTitle(
                effectiveConversationId,
                userMessage,
                completion.text,
                usedModel
              );
            }
          } catch (txError) {
            logger.warn('Transaction failed in streaming onFinish', {
              error: txError instanceof Error ? txError.message : String(txError),
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

      const rawResponse = result.toTextStreamResponse({
        headers: {
          'X-Message-Sources': JSON.stringify(sourcesMetadata),
          'X-Model-Used': usedModel,
          ...(isWebQuery ? { 'X-Strategy': 'web_query_no_rag' } : {}),
          'X-RAG-Status': isWebQuery
            ? 'skipped_web_query'
            : sources.length > 0
              ? 'hit'
              : retrievalError
                ? 'error'
                : vectorSearchDegraded
                  ? 'degraded'
                  : 'miss',
          ...(retrievalError ? { 'X-RAG-Error': retrievalError.slice(0, 200) } : {}),
          ...(vectorSearchDegraded ? { 'X-Degraded-Features': 'vector_search' } : {}),
        },
      });

      const response = wrapStreamWithErrorFrame(rawResponse, () => streamError);

      // Add rate limit headers
      addRateLimitHeaders(response.headers, rateLimitResult);

      return response;
    } else {
      // Non-streaming response with dynamic model fallback
      const bestModel = await getBestAvailableModel('chat');
      const response = await generateWithFallback(llmMessages, {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        primaryModel: bestModel,
      });

      // Extract citations
      const citations = citationHandler.extractCitations(response.text, citationMap);

      // Save assistant response
      if (effectiveConversationId) {
        await prisma.message.create({
          data: {
            chatId: effectiveConversationId,
            content: response.text,
            role: 'ASSISTANT',
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
              prompt: response.usage?.promptTokens ?? 0,
              completion: response.usage?.completionTokens ?? 0,
              total: response.usage?.totalTokens ?? 0,
            },
          },
        });
        // Invalidate chat history cache
        const { del: cacheDel } = await import('@/lib/cache');
        const { CACHE_KEYS: CK } = await import('@/lib/cache/keys');
        for (const lim of [50, 100]) {
          await cacheDel(CK.chatHistory(effectiveConversationId, lim));
        }
      }

      // Buffer usage record (batched write)
      bufferUsageRecord({
        userId,
        workspaceId,
        endpoint: '/api/chat',
        method: 'POST',
        tokensPrompt: response.usage?.promptTokens ?? 0,
        tokensCompletion: response.usage?.completionTokens ?? 0,
        tokensTotal: response.usage?.totalTokens ?? 0,
        latencyMs: Date.now() - startTime,
      });

      // Title generation is non-critical — run outside transaction
      if (effectiveConversationId) {
        await maybeGenerateTitle(
          effectiveConversationId,
          userMessage,
          response.text,
          response.model
        );
      }

      const jsonResponse = NextResponse.json({
        success: true,
        data: {
          content: response.text,
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
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    const statusCode = isTimeout
      ? 503
      : error instanceof Error && 'code' in error
        ? getErrorStatusCode((error as { code: string }).code)
        : 500;

    // Only expose error details in development to prevent information leakage
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
          message: isTimeout
            ? 'The AI service took too long to respond. Please try again.'
            : 'Failed to process chat request',
          ...(isDev && { details: errorMessage }),
        },
      },
      { status: statusCode }
    );
  }
}

// =============================================================================
// PUT Handler - Create a new chat
// =============================================================================

export async function PUT(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Your session is out of date. Please sign in again.',
          },
        },
        { status: 401 }
      );
    }

    // JWT can retain a workspaceId after DB reset or workspace deletion; Prisma would
    // reject the FK on chat create. Only attach workspace the user still belongs to.
    let resolvedWorkspaceId: string | null = null;
    if (workspaceId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, workspaceId },
        select: { workspaceId: true },
      });
      resolvedWorkspaceId = membership?.workspaceId ?? null;
    }

    // Check rate limit for chat creation
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'chat', {
      userId,
      workspaceId,
      endpoint: '/api/chat',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded',
            resetAt: new Date(rateLimitResult.reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Parse request body
    const bodySizeCheckPut = checkBodySize(req, 1_000_000);
    if (bodySizeCheckPut) return bodySizeCheckPut;

    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in chat title generation', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = chatCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }
    const { title, model } = parsed.data;

    // Create chat
    const chat = await prisma.chat.create({
      data: {
        title: title || 'New Chat',
        model: model || 'openrouter',
        userId,
        workspaceId: resolvedWorkspaceId,
      },
    });

    // Log creation (fire-and-forget)
    logAuditEvent({
      event: AuditEvent.CHAT_CREATED,
      userId,
      workspaceId: resolvedWorkspaceId ?? undefined,
      metadata: { chatId: chat.id, title: chat.title },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        chat: {
          id: chat.id,
          title: chat.title,
          model: chat.model,
          createdAt: chat.createdAt.toISOString(),
        },
      },
    });

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to create chat', {
      error: errMsg,
    });
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create chat',
          ...(isDev && { details: errMsg }),
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - Get chat history
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const conversationId = searchParams.get('conversationId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100);
    const cursor = searchParams.get('cursor');

    const effectiveId = chatId ?? conversationId;

    if (!effectiveId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_ID', message: 'chatId or conversationId is required' },
        },
        { status: 400 }
      );
    }

    // Verify user has access to this chat
    const chat = await prismaRead.chat.findFirst({
      where: {
        id: effectiveId,
        OR: [{ userId }, { workspaceId: session.user.workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
        { status: 404 }
      );
    }

    const { ConversationMemory: ConvMem } = await import('@/lib/rag/memory');
    const convMemory = new ConvMem(prismaRead);

    // Use cursor-based pagination when cursor is provided, otherwise fall back to cached simple fetch
    if (cursor) {
      const { messages, nextCursor } = await convMemory.getHistoryCursor(effectiveId, {
        limit,
        cursor,
      });

      return NextResponse.json({
        success: true,
        data: {
          messages: messages.map(
            (m: {
              id: string;
              role: string;
              content: string;
              createdAt: Date;
              sources?: unknown;
            }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
              sources: m.sources,
            })
          ),
          count: messages.length,
          nextCursor,
        },
      });
    }

    const { getOrSet } = await import('@/lib/cache');
    const { CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache/keys');

    const messages = await getOrSet(
      CACHE_KEYS.chatHistory(effectiveId, limit),
      async () => {
        const mem = new ConvMem(prismaRead);
        return mem.getHistory(effectiveId, limit);
      },
      CACHE_TTL.CHAT_HISTORY
    );

    return NextResponse.json({
      success: true,
      data: {
        messages: messages.map(
          (m: {
            id: string;
            role: string;
            content: string;
            createdAt: Date;
            sources?: unknown;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            sources: m.sources,
          })
        ),
        count: messages.length,
      },
    });
  } catch (error) {
    logger.warn('Failed to retrieve chat history', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve chat history' },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE Handler - Delete chat
// =============================================================================

export async function DELETE(req: NextRequest) {
  const writeLog = (msg: string, meta?: unknown) => {
    logger.debug(
      msg,
      typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : undefined
    );
  };

  try {
    writeLog('DELETE CHAT - Handler entered');
    // Authenticate user
    const session = await auth();
    writeLog('DELETE CHAT - Session retrieved', session);
    if (!session?.user?.id) {
      writeLog('DELETE CHAT - Unauthorized');
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    writeLog('DELETE CHAT - Parsed params', { chatId, userId, workspaceId });

    if (!chatId) {
      writeLog('DELETE CHAT - Missing chatId');
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'chatId is required' } },
        { status: 400 }
      );
    }

    // Verify user has access to delete this chat
    writeLog('DELETE CHAT - Querying database');
    const chat = await prismaRead.chat.findFirst({
      where: {
        id: chatId,
        ...(workspaceId ? { OR: [{ userId }, { workspaceId }] } : { userId }),
      },
    });
    writeLog('DELETE CHAT - Query result', {
      chatFound: !!chat,
      chatUserId: chat?.userId,
      chatWorkspaceId: chat?.workspaceId,
    });

    if (!chat) {
      writeLog('DELETE CHAT - Chat not found or access denied');
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
        { status: 404 }
      );
    }

    // Check delete permission for workspace chats
    if (chat.workspaceId && chat.userId !== userId) {
      writeLog('DELETE CHAT - Checking permission for workspace chat owned by someone else');
      const canDelete = await checkPermission(userId, chat.workspaceId, Permission.DELETE_CHATS);
      writeLog('DELETE CHAT - Permission check result', { canDelete });
      if (!canDelete) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }
    }

    // Delete chat (cascade will handle messages)
    writeLog('DELETE CHAT - Executing prisma delete');
    await prisma.chat.delete({
      where: { id: chatId },
    });
    writeLog('DELETE CHAT - Database delete succeeded');

    // Log deletion (fire-and-forget)
    logAuditEvent({
      event: AuditEvent.CHAT_DELETED,
      userId,
      workspaceId: chat.workspaceId ?? undefined,
      metadata: { chatId },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Chat deleted successfully' },
    });
  } catch (error) {
    writeLog('DELETE CHAT - Error caught', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete chat' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH Handler - Update chat (title, model, etc.)
// =============================================================================

export async function PATCH(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse request body
    const bodySizeCheckPatch = checkBodySize(req, 1_000_000);
    if (bodySizeCheckPatch) return bodySizeCheckPatch;

    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in chat update', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = chatUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }
    const { chatId, title, model } = parsed.data;

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'chatId is required' } },
        { status: 400 }
      );
    }

    // Verify user has access to this chat
    const chat = await prismaRead.chat.findFirst({
      where: {
        id: chatId,
        ...(workspaceId ? { OR: [{ userId }, { workspaceId }] } : { userId }),
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chat not found' } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: { title?: string; model?: string } = {};
    if (title !== undefined) updateData.title = title;
    if (model !== undefined) updateData.model = model;

    // Update chat (with optimistic locking if If-Match provided)
    let updatedChat: Record<string, unknown>;
    const expectedVersion = extractVersion(req.headers);
    try {
      if (expectedVersion !== null) {
        updatedChat = await updateWithVersion('chat', chatId, updateData, expectedVersion);
      } else {
        updatedChat = await prisma.chat.update({
          where: { id: chatId },
          data: updateData,
        });
      }
    } catch (e) {
      if (e instanceof ConcurrentModificationError) {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICT', message: e.message } },
          { status: 409 }
        );
      }
      throw e;
    }

    // Log update (fire-and-forget)
    logAuditEvent({
      event: AuditEvent.CHAT_UPDATED,
      userId,
      workspaceId: chat.workspaceId ?? undefined,
      metadata: { chatId, updates: Object.keys(updateData) },
    });

    const chatResult = updatedChat;
    return NextResponse.json({
      success: true,
      data: {
        chat: {
          id: chatResult.id,
          title: chatResult.title,
          model: chatResult.model,
          version: chatResult.version,
          updatedAt: (chatResult.updatedAt as Date).toISOString(),
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to update chat', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update chat' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve model name to LanguageModel — delegates to centralized resolver.
 * Used as fallback in `resolveDynamicModel(id) ?? getModel(id)` patterns.
 */
function getModel(modelName: string): LanguageModel {
  const resolved = resolveDynamicModel(modelName);
  if (!resolved) {
    throw new Error(`No provider available for model: ${modelName}`);
  }
  return resolved;
}

/**
 * Try to generate text with fallback models.
 * Uses dynamic model discovery to get the full fallback chain.
 */
async function generateWithFallback(
  messages: LLMMessage[],
  options: {
    temperature: number;
    maxTokens: number;
    primaryModel: string;
  }
): Promise<{
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const { modelsToTry: discoveredModels } = await getModelsForStreaming('chat');
  const modelsToTry = [
    options.primaryModel,
    ...discoveredModels.filter((m) => m !== options.primaryModel),
  ];

  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      const { llmCircuitBreaker: breaker } = await import('@/lib/resilience/external-services');
      const resolved = resolveDynamicModel(modelName) ?? getModel(modelName);
      const result = await breaker.execute(async () =>
        generateText({
          model: resolved,
          messages,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          abortSignal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
        })
      );

      // Return successful result with the model that worked
      return {
        text: result.text,
        model: modelName,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens ?? 0,
              completionTokens: result.usage.completionTokens ?? 0,
              totalTokens: (result.usage.promptTokens ?? 0) + (result.usage.completionTokens ?? 0),
            }
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Model ${modelName} failed, trying fallback`, {
        error: lastError.message,
      });
      // Continue to next model in chain
    }
  }

  // All models failed
  throw lastError || new Error('All models in fallback chain failed');
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

/**
 * Generate a title for the chat based on the first user message and assistant response
 * Only generates if the chat still has the default title
 */
async function maybeGenerateTitle(
  chatId: string,
  userMessage: string,
  assistantResponse: string,
  modelName: string
): Promise<void> {
  try {
    // Check if chat has default title
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { title: true },
    });

    if (!chat || (chat.title !== 'New Chat' && chat.title !== '')) {
      return; // Already has a custom title
    }

    // Generate title using a quick LLM call
    const titleModel = modelName.includes(':') ? await getBestAvailableModel('fast') : modelName;
    const resolvedTitleModel = resolveDynamicModel(titleModel) ?? getModel(titleModel);

    const { text: title } = await generateText({
      model: resolvedTitleModel,
      messages: [
        {
          role: 'system',
          content:
            'Generate a concise 4-6 word title for this conversation. Return ONLY the title, no quotes or explanation.',
        },
        {
          role: 'user',
          content: `User: ${userMessage.slice(0, 200)}\n\nAssistant: ${assistantResponse.slice(0, 200)}`,
        },
      ],
      maxTokens: 20,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(10_000),
    });

    const cleanTitle = title
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 100);

    if (cleanTitle && cleanTitle.length > 0) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { title: cleanTitle },
      });

      logger.info('Generated chat title', { chatId, title: cleanTitle });
    }
  } catch (error) {
    // Don't fail the chat if title generation fails
    logger.warn('Failed to generate chat title', {
      chatId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
