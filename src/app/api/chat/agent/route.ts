/**
 * Agentic Chat API Route with Streaming Support
 * Uses Query Router + ReAct Agent + Multi-Step Reasoning for intelligent query handling
 *
 * Enhanced with:
 * - Agent memory persistence
 * - Streaming ReAct reasoning steps
 * - Agent configuration from request
 * - Tool selection based on settings
 * - Agent analytics tracking
 */

import { createOpenAI, openai } from '@ai-sdk/openai';
import { type LanguageModel, streamText } from 'ai';
import { createOllama } from 'ollama-ai-provider';
import { asModel } from '@/lib/ai/types';
import { checkBodySize } from '@/lib/api/middleware';
import { wrapStreamWithErrorFrame } from '@/lib/api/stream-error-wrapper';
import { apiError, apiSuccess } from '@/lib/api-response';

const fireworks = createOpenAI({
  baseURL: 'https://api.fireworks.ai/inference/v1',
  apiKey: process.env.FIREWORKS_API_KEY,
});

import { createProviderFromEnv, type LLMMessage } from '@/lib/ai/llm';
import {
  getBestAvailableModel,
  getModelsForStreaming,
  resolveModel as resolveDynamicModel,
} from '@/lib/ai/model-discovery';
import { modelHealthCache } from '@/lib/ai/model-health-cache';
import { type AgentAnalytics, createAgentAnalytics } from '@/lib/analytics/agent-analytics';
import { MetricType, recordMetric } from '@/lib/analytics/rag-metrics';
import { trackTokenUsage } from '@/lib/analytics/token-tracking';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  type AgentMemory,
  createAgentMemory,
  createQueryRouter,
  createReActAgent,
  type QueryClassification,
  QueryType,
} from '@/lib/rag/agent';
import type { ReActStep } from '@/lib/rag/agent/react';
import { CitationHandler, sourcesToChunks } from '@/lib/rag/citations';
import { ConversationMemory } from '@/lib/rag/memory';
import {
  calculatorTool,
  codeExecutorTool,
  createWebSearchTool,
  currentTimeTool,
  documentSummaryTool,
  getDefaultWebSearchProvider,
  searchDocumentsTool,
  type WebSearchResult,
} from '@/lib/rag/tools';
import { validateChatInput } from '@/lib/security/input-validator';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import type { RAGConfig } from '@/types';

const defaultConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.5,
  temperature: 0.7,
  maxTokens: 2000,
  model: 'auto', // Dynamic — resolved at call time via model discovery
  embeddingModel: 'text-embedding-004',
};

const REACT_THRESHOLD = 0.6;

/**
 * Check if a query has strong web-search signals (current events, real-time data).
 * Used as a safety net to override LLM misclassification.
 */
function hasWebSearchSignals(query: string): boolean {
  const lower = query.toLowerCase();
  const strongSignals = [
    /\b(latest|recent|current)\s+(news|events|developments|updates|headlines|info|trends)\b/,
    /\bnews\s+(on|about|regarding)\b/,
    /\bwhat('s| is)\s+(happening|going on|trending|new)\b/,
    /\b(weather|temperature|forecast)\s+(in|at|for|like|today)\b/,
    /\b(stock\s*price|share\s*price|market)\b/,
    /\b(today|tonight)\s*(('s|is)\s+)?(news|update|weather|game|score)\b/,
    /\bwho\s+(won|is\s+winning)\b/,
    /\b(breaking|live)\s+(news|update)\b/,
    /\b(top|best)\s+\d+\s+\w+\s+(of|in)\s+\d{4}\b/,
  ];
  return strongSignals.some((p) => p.test(lower));
}

// Global analytics instance
const agentAnalytics = createAgentAnalytics();

/**
 * Resolve a model name to a LanguageModel instance.
 * Handles Fireworks/Ollama locally, delegates everything else to the
 * centralized dynamic model resolver.
 */
async function getModel(modelName: string): Promise<LanguageModel> {
  // 'auto' means dynamic discovery — resolve to best available model
  if (modelName === 'auto' || modelName === '') {
    const bestModel = await getBestAvailableModel('chat');
    const resolved = resolveDynamicModel(bestModel);
    if (resolved) return resolved;
    throw new Error(`No provider available for discovered model: ${bestModel}`);
  }

  // Fireworks models (accounts/fireworks/models/...)
  if (modelName.startsWith('accounts/fireworks/')) {
    return asModel<LanguageModel>(fireworks(modelName));
  }

  // Ollama models
  const ollamaModels = ['llama3', 'mistral', 'phi3', 'gemma2', 'codellama', 'qwen'];
  if (ollamaModels.some((m) => modelName.toLowerCase().startsWith(m))) {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
    });
    return asModel<LanguageModel>(ollama(modelName));
  }

  // OpenAI models
  if (modelName.startsWith('gpt-') || modelName.startsWith('text-')) {
    return asModel<LanguageModel>(openai(modelName));
  }

  // Use centralized dynamic resolver for everything else (OpenRouter)
  const resolved = resolveDynamicModel(modelName);
  if (resolved) return resolved;

  // Final fallback — use the best available model
  const bestModel = await getBestAvailableModel('chat');
  const fallback = resolveDynamicModel(bestModel);
  if (fallback) return fallback;

  throw new Error(`No provider available for model: ${bestModel}`);
}

interface AgentConfig {
  maxIterations: number;
  enabledTools: string[];
  enablePlanning: boolean;
  showReasoning: boolean;
  enableReflection: boolean;
  earlyTermination: boolean;
}

interface HandlerParams {
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: string;
  workspaceId: string | undefined;
  effectiveConversationId: string | undefined;
  config: RAGConfig;
  agentConfig: AgentConfig;
  shouldStream: boolean;
  shouldStreamReasoning: boolean;
  rateLimitResult: { success: boolean; limit: number; remaining: number; reset: number };
  requestId: string;
  startTime: number;
  agentMemory: AgentMemory;
  analytics: AgentAnalytics;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'agent', {
      userId,
      workspaceId,
      endpoint: '/api/chat/agent',
    });

    if (!rateLimitResult.success) {
      const errRes = apiError('RATE_LIMIT', 'Rate limit exceeded', 429, {
        resetAt: new Date(rateLimitResult.reset).toISOString(),
      });
      errRes.headers.set(
        'Retry-After',
        Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
      );
      return errRes;
    }

    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: { action: 'agent_chat', requiredPermission: Permission.READ_DOCUMENTS },
          severity: 'WARNING',
        });
        return apiError('FORBIDDEN', 'Access denied to workspace', 403);
      }
    }

    let body: unknown;
    try {
      const bodySizeCheck = checkBodySize(req, 1_000_000);
      if (bodySizeCheck) return bodySizeCheck;

      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in agent chat request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    let validatedInput: ReturnType<typeof validateChatInput>;
    try {
      validatedInput = validateChatInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return apiError('VALIDATION_ERROR', 'Validation failed', 400, error.message);
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

    // Parse agent configuration from request
    const agentConfig: AgentConfig = {
      maxIterations:
        (body as { agentConfig?: { maxIterations?: number } })?.agentConfig?.maxIterations ?? 5,
      enabledTools: (body as { agentConfig?: { enabledTools?: string[] } })?.agentConfig
        ?.enabledTools ?? ['calculator', 'document_search', 'current_time'],
      enablePlanning:
        (body as { agentConfig?: { enablePlanning?: boolean } })?.agentConfig?.enablePlanning ??
        true,
      showReasoning:
        (body as { agentConfig?: { showReasoning?: boolean } })?.agentConfig?.showReasoning ?? true,
      enableReflection:
        (body as { agentConfig?: { enableReflection?: boolean } })?.agentConfig?.enableReflection ??
        true,
      earlyTermination:
        (body as { agentConfig?: { earlyTermination?: boolean } })?.agentConfig?.earlyTermination ??
        true,
    };

    const shouldStreamReasoning = (body as { streamReasoning?: boolean })?.streamReasoning ?? false;

    const config = { ...defaultConfig, ...userConfig };
    const effectiveConversationId = conversationId ?? chatId;
    const userMessage = messages[messages.length - 1].content;

    // Initialize agent memory
    const agentMemory = createAgentMemory(userId, workspaceId, effectiveConversationId);

    // Start analytics session
    const analytics = createAgentAnalytics();
    analytics.startSession(userId, workspaceId);

    const memory = new ConversationMemory(prisma);
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (effectiveConversationId) {
      const chat = await prisma.chat.findFirst({
        where: {
          id: effectiveConversationId,
          OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
        },
      });

      if (!chat) {
        return apiError('NOT_FOUND', 'Chat not found', 404);
      }

      const recentMessages = await memory.getRecentMessages(effectiveConversationId, 10);
      history = recentMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
    }

    const router = createQueryRouter({
      model: config.model,
      temperature: 0.3,
    });

    const classificationStart = Date.now();
    let classification = await router.classify(userMessage, history);
    const classificationLatency = Date.now() - classificationStart;

    // Safety net: if router says RETRIEVE but query has strong web-search signals
    // and web_search is enabled, re-classify as WEB_SEARCH
    if (
      classification.type === QueryType.RETRIEVE &&
      agentConfig.enabledTools.includes('web_search') &&
      hasWebSearchSignals(userMessage)
    ) {
      logger.info('Overriding RETRIEVE classification to WEB_SEARCH based on keyword signals', {
        query: userMessage.slice(0, 100),
        originalConfidence: classification.confidence,
      });
      classification = {
        type: QueryType.WEB_SEARCH,
        confidence: 0.9,
        reasoning: `Overridden from RETRIEVE: query contains web-search keywords. Original reasoning: ${classification.reasoning}`,
        suggestedTools: ['web_search'],
      };
    }

    await recordMetric({
      type: MetricType.QUERY_CLASSIFICATION,
      value: classificationLatency,
      labels: {
        queryType: classification.type,
        confidence: classification.confidence.toFixed(2),
        userId,
        workspaceId: workspaceId ?? 'personal',
      },
    });

    await logAuditEvent({
      event: AuditEvent.AGENT_QUERY_CLASSIFIED,
      userId,
      workspaceId,
      metadata: {
        query: userMessage,
        classification: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        suggestedTools: classification.suggestedTools,
        agentConfig,
      },
    });

    let response: Response;

    switch (classification.type) {
      case QueryType.DIRECT_ANSWER:
        response = await handleDirectAnswer({
          userMessage,
          history,
          userId,
          workspaceId,
          effectiveConversationId,
          config,
          agentConfig,
          shouldStream,
          shouldStreamReasoning,
          rateLimitResult,
          requestId,
          startTime,
          agentMemory,
          analytics,
        });
        break;

      case QueryType.CALCULATE:
        response = await handleCalculation({
          userMessage,
          history,
          userId,
          workspaceId,
          effectiveConversationId,
          config,
          agentConfig,
          shouldStream,
          shouldStreamReasoning,
          rateLimitResult,
          requestId,
          startTime,
          classification,
          agentMemory,
          analytics,
        });
        break;

      case QueryType.WEB_SEARCH:
        response = await handleWebSearch({
          userMessage,
          history,
          userId,
          workspaceId,
          effectiveConversationId,
          config,
          agentConfig,
          shouldStream,
          shouldStreamReasoning,
          rateLimitResult,
          requestId,
          startTime,
          classification,
          agentMemory,
          analytics,
        });
        break;

      case QueryType.RETRIEVE:
        if (classification.confidence >= REACT_THRESHOLD) {
          response = await handleReAct({
            userMessage,
            history,
            userId,
            workspaceId,
            effectiveConversationId,
            config,
            agentConfig,
            shouldStream,
            shouldStreamReasoning,
            rateLimitResult,
            requestId,
            startTime,
            classification,
            agentMemory,
            analytics,
          });
        } else {
          response = await handleDirectRetrieval({
            userMessage,
            history,
            userId,
            workspaceId,
            effectiveConversationId,
            config,
            agentConfig,
            shouldStream,
            shouldStreamReasoning,
            rateLimitResult,
            requestId,
            startTime,
            agentMemory,
            analytics,
          });
        }
        break;

      case QueryType.CLARIFY:
        response = await handleClarification({
          userMessage,
          history,
          classification,
          userId,
          workspaceId,
          effectiveConversationId,
          agentConfig,
          shouldStream,
          rateLimitResult,
          requestId,
          agentMemory,
          analytics,
        });
        break;

      default:
        response = await handleReAct({
          userMessage,
          history,
          userId,
          workspaceId,
          effectiveConversationId,
          config,
          agentConfig,
          shouldStream,
          shouldStreamReasoning,
          rateLimitResult,
          requestId,
          startTime,
          classification,
          agentMemory,
          analytics,
        });
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return apiError('INTERNAL_ERROR', 'Failed to process agentic chat request', 500, {
      message: errorMessage,
      requestId,
    });
  }
}

async function handleDirectAnswer(params: HandlerParams): Promise<Response> {
  const {
    userMessage,
    history,
    userId,
    workspaceId,
    effectiveConversationId,
    config,
    shouldStream,
    rateLimitResult,
    requestId,
    agentMemory,
    analytics,
  } = params;

  const llmProvider = createProviderFromEnv();
  const memory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await memory.addMessage(effectiveConversationId, {
      role: 'user',
      content: userMessage,
    });
  }

  // Get memory context
  const memoryContext = await agentMemory.buildMemoryContext();

  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant. Answer directly and concisely.
${memoryContext ? `\nContext:\n${memoryContext}` : ''}`,
    },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const queryStartTime = Date.now();

  if (shouldStream) {
    let streamError: string | null = null;
    const result = streamText({
      model: await getModel(config.model),
      messages: llmMessages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      onError: (error) => {
        streamError = error instanceof Error ? error.message : String(error);
        logger.error('Agent stream error', {
          model: config.model,
          error: streamError,
        });
      },
      onFinish: async (completion) => {
        if (effectiveConversationId) {
          await memory.addMessage(effectiveConversationId, {
            role: 'assistant',
            content: completion.text,
          });
        }
        await trackTokenUsage({
          userId,
          workspaceId: workspaceId ?? '',
          conversationId: effectiveConversationId ?? '',
          promptTokens: completion.usage?.promptTokens ?? 0,
          completionTokens: completion.usage?.completionTokens ?? 0,
          model: config.model,
        });

        // Track analytics
        await analytics.trackQuery({
          queryId: crypto.randomUUID(),
          userId,
          query: userMessage,
          queryType: 'direct_answer',
          strategy: 'direct_answer',
          success: true,
          steps: 1,
          toolCalls: 0,
          latency: Date.now() - queryStartTime,
          tokensUsed: {
            prompt: completion.usage?.promptTokens ?? 0,
            completion: completion.usage?.completionTokens ?? 0,
            total:
              (completion.usage?.promptTokens ?? 0) + (completion.usage?.completionTokens ?? 0),
          },
          toolUsage: {},
          timestamp: new Date(),
        });
      },
    });

    const response = wrapStreamWithErrorFrame(
      result.toTextStreamResponse({
        headers: {
          'X-Request-Id': requestId,
          'X-Strategy': 'direct_answer',
        },
      }),
      () => streamError
    );
    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } else {
    const response = await llmProvider.generate(llmMessages, {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    if (effectiveConversationId) {
      await memory.addMessage(effectiveConversationId, {
        role: 'assistant',
        content: response.content,
      });
    }

    await trackTokenUsage({
      userId,
      workspaceId: workspaceId ?? '',
      conversationId: effectiveConversationId ?? '',
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      model: config.model,
    });

    // Track analytics
    await analytics.trackQuery({
      queryId: crypto.randomUUID(),
      userId,
      query: userMessage,
      queryType: 'direct_answer',
      strategy: 'direct_answer',
      success: true,
      steps: 1,
      toolCalls: 0,
      latency: Date.now() - queryStartTime,
      tokensUsed: {
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens,
        total: response.usage.totalTokens,
      },
      toolUsage: {},
      timestamp: new Date(),
    });

    const jsonResponse = apiSuccess({
      content: response.content,
      strategy: 'direct_answer',
      usage: response.usage,
    });
    addRateLimitHeaders(jsonResponse.headers, rateLimitResult);
    return jsonResponse;
  }
}

async function handleCalculation(
  params: HandlerParams & { classification: QueryClassification }
): Promise<Response> {
  const {
    userMessage,
    history,
    userId,
    workspaceId,
    effectiveConversationId,
    config,
    shouldStream,
    rateLimitResult,
    requestId,
    agentMemory,
    analytics,
  } = params;

  const queryStartTime = Date.now();
  const convMemory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await convMemory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
  }

  // Use streamText directly for calculations — free-tier models handle math reliably
  // when given a clear system prompt, without needing the fragile ReAct loop
  const memoryContext = await agentMemory.buildMemoryContext();

  const systemPrompt = `You are a helpful assistant that specializes in calculations and math.
When the user asks a calculation question, show your work step by step and provide the final answer clearly.
If there are units involved, handle the conversions properly.
Be precise with numbers and show intermediate steps.

${memoryContext ? `User Context:\n${memoryContext}` : ''}`;

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  if (shouldStream) {
    let streamError: string | null = null;
    const result = streamText({
      model: await getModel(config.model),
      messages: llmMessages,
      temperature: 0.1,
      maxTokens: config.maxTokens,
      onError: (error) => {
        streamError = error instanceof Error ? error.message : String(error);
        logger.error('Calculation stream error', { model: config.model, error: streamError });
      },
      onFinish: async (completion) => {
        if (effectiveConversationId) {
          await convMemory.addMessage(effectiveConversationId, {
            role: 'assistant',
            content: completion.text,
          });
        }

        await trackTokenUsage({
          userId,
          workspaceId: workspaceId ?? '',
          conversationId: effectiveConversationId ?? '',
          promptTokens: completion.usage?.promptTokens ?? 0,
          completionTokens: completion.usage?.completionTokens ?? 0,
          model: config.model,
        });

        await analytics.trackQuery({
          queryId: crypto.randomUUID(),
          userId,
          query: userMessage,
          queryType: 'calculate',
          strategy: 'calculate_direct',
          success: true,
          steps: 1,
          toolCalls: 0,
          latency: Date.now() - queryStartTime,
          tokensUsed: {
            prompt: completion.usage?.promptTokens ?? 0,
            completion: completion.usage?.completionTokens ?? 0,
            total:
              (completion.usage?.promptTokens ?? 0) + (completion.usage?.completionTokens ?? 0),
          },
          toolUsage: { calculator: 1 },
          timestamp: new Date(),
        });
      },
    });

    const response = wrapStreamWithErrorFrame(
      result.toTextStreamResponse({
        headers: {
          'X-Request-Id': requestId,
          'X-Strategy': 'calculate',
          'X-Model-Used': config.model,
        },
      }),
      () => streamError
    );
    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } else {
    const llmProvider = createProviderFromEnv();
    const llmResponse = await llmProvider.generate(llmMessages, {
      model: config.model,
      temperature: 0.1,
      maxTokens: config.maxTokens,
    });

    if (effectiveConversationId) {
      await convMemory.addMessage(effectiveConversationId, {
        role: 'assistant',
        content: llmResponse.content,
      });
    }

    await trackTokenUsage({
      userId,
      workspaceId: workspaceId ?? '',
      conversationId: effectiveConversationId ?? '',
      promptTokens: llmResponse.usage.promptTokens,
      completionTokens: llmResponse.usage.completionTokens,
      model: config.model,
    });

    await analytics.trackQuery({
      queryId: crypto.randomUUID(),
      userId,
      query: userMessage,
      queryType: 'calculate',
      strategy: 'calculate_direct',
      success: true,
      steps: 1,
      toolCalls: 0,
      latency: Date.now() - queryStartTime,
      tokensUsed: {
        prompt: llmResponse.usage.promptTokens,
        completion: llmResponse.usage.completionTokens,
        total: llmResponse.usage.totalTokens,
      },
      toolUsage: { calculator: 1 },
      timestamp: new Date(),
    });

    const jsonResponse = apiSuccess({
      content: llmResponse.content,
      strategy: 'calculate',
      usage: llmResponse.usage,
    });
    addRateLimitHeaders(jsonResponse.headers, rateLimitResult);
    return jsonResponse;
  }
}

async function handleWebSearch(
  params: HandlerParams & { classification: QueryClassification }
): Promise<Response> {
  const {
    userMessage,
    history,
    userId,
    workspaceId,
    effectiveConversationId,
    config,
    shouldStream,
    rateLimitResult,
    requestId,
    agentMemory,
    analytics,
  } = params;

  const queryStartTime = Date.now();
  const convMemory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await convMemory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
  }

  // Call web search directly — bypass ReAct loop for reliability with free-tier models
  const provider = getDefaultWebSearchProvider();
  let searchResults: WebSearchResult[] = [];

  try {
    searchResults = await provider.search(userMessage, {
      maxResults: 8,
      includeAnswer: true,
    });
  } catch (err) {
    logger.warn('Web search provider failed', {
      error: err instanceof Error ? err.message : String(err),
      query: userMessage,
    });
  }

  // Build context from search results
  let searchContext = '';
  if (searchResults.length > 0) {
    searchContext = searchResults
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}${r.content ? `\n${r.content.slice(0, 500)}` : ''}`
      )
      .join('\n\n');
  }

  const memoryContext = await agentMemory.buildMemoryContext();

  const systemPrompt = searchContext
    ? `You are a helpful assistant answering questions using web search results.
Synthesize the information below into a clear, comprehensive answer.
Cite sources by referencing the bracketed numbers [1], [2], etc.
If the results don't fully answer the question, share what you found and note the gaps.

## Web Search Results:
${searchContext}
${memoryContext ? `\n## User Context:\n${memoryContext}` : ''}`
    : `You are a helpful assistant. The web search did not return any results.
Answer the user's question to the best of your ability and note that current web results were unavailable.
${memoryContext ? `\nUser Context:\n${memoryContext}` : ''}`;

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  if (shouldStream) {
    // Resolve model with fallback chain — free models get rate-limited frequently
    const { modelsToTry } = await getModelsForStreaming('chat');
    let usedModel = modelsToTry[0] || (await getBestAvailableModel('chat'));
    let streamError: string | null = null;

    // Probe models to find one that works (tiny request, no stream consumption)
    const probeMs = 5_000;
    for (const modelId of modelsToTry.slice(0, 3)) {
      const model = resolveDynamicModel(modelId);
      if (!model) continue;
      try {
        const { generateText: probe } = await import('ai');
        await probe({
          model,
          messages: [{ role: 'user', content: 'ok' }],
          maxTokens: 1,
          abortSignal: AbortSignal.timeout(probeMs),
        });
        usedModel = modelId;
        modelHealthCache.recordSuccess(modelId);
        break;
      } catch (err) {
        modelHealthCache.recordFailure(modelId);
        logger.warn('Web search model probe failed, trying next', {
          model: modelId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const resolvedModel = resolveDynamicModel(usedModel);
    if (!resolvedModel) {
      // All models failed — return search results as plain text
      const fallbackContent = searchContext
        ? `Here are the web search results I found:\n\n${searchResults
            .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   ${r.url}`)
            .join('\n\n')}`
        : 'Unable to perform web search and no AI models are currently available. Please try again in a moment.';

      const encoder = new TextEncoder();
      const fallbackStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(fallbackContent));
          controller.close();
        },
      });
      const fallbackResponse = new Response(fallbackStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Request-Id': requestId,
          'X-Strategy': 'web_search_fallback',
          'X-Model-Used': 'none',
        },
      });
      addRateLimitHeaders(fallbackResponse.headers, rateLimitResult);
      return fallbackResponse;
    }

    const result = streamText({
      model: resolvedModel,
      messages: llmMessages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      onError: (error) => {
        streamError = error instanceof Error ? error.message : String(error);
        logger.warn('Web search stream error', { model: usedModel, error: streamError });
      },
      onFinish: async (completion) => {
        if (completion.text) {
          modelHealthCache.recordSuccess(usedModel);
        }
        if (effectiveConversationId) {
          await convMemory.addMessage(effectiveConversationId, {
            role: 'assistant',
            content: completion.text,
          });
        }

        await trackTokenUsage({
          userId,
          workspaceId: workspaceId ?? '',
          conversationId: effectiveConversationId ?? '',
          promptTokens: completion.usage?.promptTokens ?? 0,
          completionTokens: completion.usage?.completionTokens ?? 0,
          model: usedModel,
        });

        await analytics.trackQuery({
          queryId: crypto.randomUUID(),
          userId,
          query: userMessage,
          queryType: 'web_search',
          strategy: 'web_search_direct',
          success: searchResults.length > 0,
          steps: 1,
          toolCalls: 1,
          latency: Date.now() - queryStartTime,
          tokensUsed: {
            prompt: completion.usage?.promptTokens ?? 0,
            completion: completion.usage?.completionTokens ?? 0,
            total:
              (completion.usage?.promptTokens ?? 0) + (completion.usage?.completionTokens ?? 0),
          },
          toolUsage: { web_search: 1 },
          timestamp: new Date(),
        });
      },
    });

    const response = wrapStreamWithErrorFrame(
      result.toTextStreamResponse({
        headers: {
          'X-Request-Id': requestId,
          'X-Strategy': 'web_search',
          'X-Model-Used': usedModel,
        },
      }),
      () => streamError
    );
    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } else {
    const llmProvider = createProviderFromEnv();
    const llmResponse = await llmProvider.generate(llmMessages, config);

    if (effectiveConversationId) {
      await convMemory.addMessage(effectiveConversationId, {
        role: 'assistant',
        content: llmResponse.content,
      });
    }

    await trackTokenUsage({
      userId,
      workspaceId: workspaceId ?? '',
      conversationId: effectiveConversationId ?? '',
      promptTokens: llmResponse.usage.promptTokens,
      completionTokens: llmResponse.usage.completionTokens,
      model: config.model,
    });

    await analytics.trackQuery({
      queryId: crypto.randomUUID(),
      userId,
      query: userMessage,
      queryType: 'web_search',
      strategy: 'web_search_direct',
      success: searchResults.length > 0,
      steps: 1,
      toolCalls: 1,
      latency: Date.now() - queryStartTime,
      tokensUsed: {
        prompt: llmResponse.usage.promptTokens,
        completion: llmResponse.usage.completionTokens,
        total: llmResponse.usage.totalTokens,
      },
      toolUsage: { web_search: 1 },
      timestamp: new Date(),
    });

    const jsonResponse = apiSuccess({
      content: llmResponse.content,
      strategy: 'web_search',
      sources: searchResults.map((r, i) => ({
        id: `web-${i}`,
        content: `${r.title}\n${r.snippet}`,
        metadata: {
          documentId: r.url,
          documentName: r.title,
          source: r.source || 'web',
          url: r.url,
          chunkIndex: i,
          totalChunks: searchResults.length,
        },
        similarity: 1 - i * 0.1,
      })),
      usage: llmResponse.usage,
    });
    addRateLimitHeaders(jsonResponse.headers, rateLimitResult);
    return jsonResponse;
  }
}

async function handleDirectRetrieval(params: HandlerParams): Promise<Response> {
  const queryStartTime = Date.now();
  const {
    userMessage,
    history,
    userId,
    workspaceId,
    effectiveConversationId,
    config,
    shouldStream,
    rateLimitResult,
    requestId,
    agentMemory,
    analytics,
  } = params;

  const { retrieveSources } = await import('@/lib/rag/retrieval');
  let sources: Awaited<ReturnType<typeof retrieveSources>> = [];
  try {
    sources = await retrieveSources(userMessage, userId, config);
  } catch (err) {
    // Continue without RAG context if retrieval fails
    const { logger } = await import('@/lib/logger');
    logger.warn('Source retrieval failed in agent, continuing without RAG context', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const citationHandler = new CitationHandler();
  const chunks = sourcesToChunks(sources);
  const { context, citationMap } = citationHandler.formatContextWithCitations(chunks);

  const { buildSystemPromptWithContext } = await import('@/lib/ai/prompts/templates');

  // Get memory context
  const memoryContext = await agentMemory.buildMemoryContext();

  const systemPrompt = buildSystemPromptWithContext(
    `${context}${memoryContext ? `\n\nUser Context:\n${memoryContext}` : ''}`,
    {
      style: config.temperature < 0.5 ? 'concise' : 'balanced',
    }
  );

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const memory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await memory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
  }

  if (shouldStream) {
    let streamError: string | null = null;
    const result = streamText({
      model: await getModel(config.model),
      messages: llmMessages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      onError: (error) => {
        streamError = error instanceof Error ? error.message : String(error);
        logger.error('Agent direct retrieval stream error', {
          model: config.model,
          error: streamError,
        });
      },
      onFinish: async (completion) => {
        citationHandler.extractCitations(completion.text, citationMap);

        if (effectiveConversationId) {
          await memory.addMessage(effectiveConversationId, {
            role: 'assistant',
            content: completion.text,
          });
        }

        await trackTokenUsage({
          userId,
          workspaceId: workspaceId ?? '',
          conversationId: effectiveConversationId ?? '',
          promptTokens: completion.usage?.promptTokens ?? 0,
          completionTokens: completion.usage?.completionTokens ?? 0,
          model: config.model,
        });

        // Track analytics
        await analytics.trackQuery({
          queryId: crypto.randomUUID(),
          userId,
          query: userMessage,
          queryType: 'direct_retrieval',
          strategy: 'direct_retrieval',
          success: true,
          steps: 1,
          toolCalls: 0,
          latency: Date.now() - queryStartTime,
          tokensUsed: {
            prompt: completion.usage?.promptTokens ?? 0,
            completion: completion.usage?.completionTokens ?? 0,
            total:
              (completion.usage?.promptTokens ?? 0) + (completion.usage?.completionTokens ?? 0),
          },
          toolUsage: { document_search: 1 },
          timestamp: new Date(),
        });
      },
    });

    const sourcesMetadata = sources.map((s) => ({
      id: s.id,
      documentName: s.metadata.documentName,
      documentId: s.metadata.documentId,
      page: s.metadata.page,
      similarity: s.similarity,
    }));

    const response = wrapStreamWithErrorFrame(
      result.toTextStreamResponse({
        headers: {
          'X-Request-Id': requestId,
          'X-Strategy': 'direct_retrieval',
          'X-Message-Sources': JSON.stringify(sourcesMetadata),
        },
      }),
      () => streamError
    );
    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } else {
    const llmProvider = createProviderFromEnv();
    const response = await llmProvider.generate(llmMessages, config);
    const citations = citationHandler.extractCitations(response.content, citationMap);

    if (effectiveConversationId) {
      await memory.addMessage(effectiveConversationId, {
        role: 'assistant',
        content: response.content,
      });
    }

    await trackTokenUsage({
      userId,
      workspaceId: workspaceId ?? '',
      conversationId: effectiveConversationId ?? '',
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      model: config.model,
    });

    // Track analytics
    await analytics.trackQuery({
      queryId: crypto.randomUUID(),
      userId,
      query: userMessage,
      queryType: 'direct_retrieval',
      strategy: 'direct_retrieval',
      success: true,
      steps: 1,
      toolCalls: 0,
      latency: Date.now() - queryStartTime,
      tokensUsed: {
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens,
        total: response.usage.totalTokens,
      },
      toolUsage: { document_search: 1 },
      timestamp: new Date(),
    });

    const jsonResponse = apiSuccess({
      content: response.content,
      strategy: 'direct_retrieval',
      sources: citations,
      usage: response.usage,
    });
    addRateLimitHeaders(jsonResponse.headers, rateLimitResult);
    return jsonResponse;
  }
}

async function handleReAct(
  params: HandlerParams & { classification: QueryClassification }
): Promise<Response> {
  const {
    userMessage,
    userId,
    workspaceId,
    effectiveConversationId,
    config,
    agentConfig,
    shouldStream,
    shouldStreamReasoning,
    agentMemory,
    analytics,
  } = params;

  const MAX_ITERATIONS = Math.min(agentConfig.maxIterations, 10); // hard cap at 10

  // Build tool list based on enabled tools
  const tools = [];
  if (agentConfig.enabledTools.includes('calculator')) tools.push(calculatorTool);
  if (agentConfig.enabledTools.includes('document_search')) tools.push(searchDocumentsTool);
  if (agentConfig.enabledTools.includes('document_summary')) tools.push(documentSummaryTool);
  if (agentConfig.enabledTools.includes('current_time')) tools.push(currentTimeTool);
  if (agentConfig.enabledTools.includes('code_executor')) tools.push(codeExecutorTool);

  // Add web search if enabled
  if (agentConfig.enabledTools.includes('web_search')) {
    try {
      const webSearch = createWebSearchTool(getDefaultWebSearchProvider());
      tools.push(webSearch);
    } catch (error: unknown) {
      logger.debug('Web search tool not configured, skipping', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  const agent = createReActAgent(tools, {
    model: config.model,
    maxSteps: MAX_ITERATIONS,
    enableReflection: agentConfig.enableReflection,
    earlyTermination: agentConfig.earlyTermination,
  });

  // Handle streaming reasoning if requested
  if (shouldStreamReasoning) {
    const encoder = new TextEncoder();
    let toolsUsedCount = 0;
    let iterationsCount = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamResult = agent.stream(userMessage, {
            workspaceId: workspaceId ?? '',
            userId,
            memory: agentMemory,
            enablePlanning: agentConfig.enablePlanning,
          });

          for await (const event of streamResult) {
            if (event.type === 'action') {
              toolsUsedCount++;
            }
            iterationsCount++;
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          controller.close();
        } catch (error) {
          // Log error but send it as a stream event so the client can recover
          const errorEvent = JSON.stringify({
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error',
              partialResults: true,
            },
          });
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Agent-Tools-Used': String(toolsUsedCount),
        'X-Agent-Iterations': String(iterationsCount),
      },
    });
  }

  // Standard execution with error recovery
  let result: Awaited<ReturnType<typeof agent.execute>> | undefined;
  const toolNamesUsed: string[] = [];

  try {
    result = await agent.execute(userMessage, {
      workspaceId: workspaceId ?? '',
      userId,
      memory: agentMemory,
      enablePlanning: agentConfig.enablePlanning,
    });

    // Collect tool names from completed steps
    for (const step of result.steps) {
      if (step.action && step.action !== 'final_answer') {
        toolNamesUsed.push(step.action);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('ReAct agent execution failed, returning partial results', {
      error: errorMessage,
      userId,
      workspaceId,
    });

    // Return a partial result so the client can still display something
    const memory = new ConversationMemory(prisma);
    const partialAnswer = `I encountered an issue while processing your request: ${errorMessage}. Please try again or rephrase your question.`;

    if (effectiveConversationId) {
      await memory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
      await memory.addMessage(effectiveConversationId, {
        role: 'assistant',
        content: partialAnswer,
      });
    }

    if (shouldStream) {
      const encoder = new TextEncoder();
      const errStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(partialAnswer));
          controller.close();
        },
      });
      return new Response(errStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Strategy': 'react',
          'X-Agent-Tools-Used': '0',
          'X-Agent-Iterations': '0',
        },
      });
    }

    const errRes = apiError('AGENT_ERROR', errorMessage, 500, {
      content: partialAnswer,
      strategy: 'react',
      iterations: 0,
      terminated: true,
      terminationReason: `Agent execution error: ${errorMessage}`,
    });
    errRes.headers.set('X-Agent-Tools-Used', '0');
    errRes.headers.set('X-Agent-Iterations', '0');
    return errRes;
  }

  const memory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await memory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
    await memory.addMessage(effectiveConversationId, {
      role: 'assistant',
      content: result.answer,
    });
  }

  await trackTokenUsage({
    userId,
    workspaceId: workspaceId ?? '',
    conversationId: effectiveConversationId ?? '',
    promptTokens: result.tokensUsed.prompt,
    completionTokens: result.tokensUsed.completion,
    model: config.model,
  });

  // Track tool usage
  const toolUsage: Record<string, number> = {};
  for (const step of result.steps) {
    if (step.action && step.action !== 'final_answer') {
      toolUsage[step.action] = (toolUsage[step.action] ?? 0) + 1;
    }
  }

  // Track analytics
  await analytics.trackQuery({
    queryId: crypto.randomUUID(),

    userId,
    query: userMessage,
    queryType: 'react',
    strategy: 'react',
    success: true,
    steps: result.iterations,
    toolCalls: result.steps.filter((s: ReActStep) => s.action !== 'final_answer').length,
    latency: result.latency,
    tokensUsed: result.tokensUsed,
    toolUsage,
    terminated: result.terminated,
    terminationReason: result.terminationReason,
    timestamp: new Date(),
  });

  // When frontend expects a text stream, return text/plain instead of JSON
  if (shouldStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(result.answer));
        controller.close();
      },
    });
    const response = new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Strategy': 'react',
        'X-Model-Used': config.model,
        'X-Agent-Tools-Used': toolNamesUsed.join(','),
        'X-Agent-Iterations': String(result.iterations),
      },
    });
    return response;
  }

  const jsonResponse = apiSuccess({
    content: result.answer,
    strategy: 'react',
    steps: agentConfig.showReasoning ? result.steps : undefined,
    sources: result.sources,
    toolCalls: result.steps.filter((s: ReActStep) => s.action !== 'final_answer').length,
    iterations: result.iterations,
    terminated: result.terminated,
    terminationReason: result.terminationReason,
    latency: result.latency,
    usage: { totalTokens: result.tokensUsed },
  });

  // Include agent execution metadata in response headers
  jsonResponse.headers.set('X-Agent-Tools-Used', toolNamesUsed.join(','));
  jsonResponse.headers.set('X-Agent-Iterations', String(result.iterations));

  return jsonResponse;
}

async function handleClarification(
  params: Omit<HandlerParams, 'config' | 'shouldStreamReasoning' | 'startTime'> & {
    classification: QueryClassification;
  }
): Promise<Response> {
  const {
    userMessage,
    classification,
    effectiveConversationId,
    shouldStream,
    rateLimitResult,
    analytics,
  } = params;

  const clarifyContent = classification.reasoning || 'Could you please clarify your question?';

  const memory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await memory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
    await memory.addMessage(effectiveConversationId, {
      role: 'assistant',
      content: clarifyContent,
    });
  }

  // Track analytics
  await analytics.trackQuery({
    queryId: crypto.randomUUID(),

    userId: '',
    query: userMessage,
    queryType: 'clarify',
    strategy: 'clarify',
    success: true,
    steps: 0,
    toolCalls: 0,
    latency: 0,
    tokensUsed: { prompt: 0, completion: 0, total: 0 },
    toolUsage: {},
    timestamp: new Date(),
  });

  if (shouldStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(clarifyContent));
        controller.close();
      },
    });
    const response = new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Request-Id': rateLimitResult ? String(rateLimitResult) : '',
        'X-Strategy': 'clarify',
      },
    });
    if (rateLimitResult) addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  }

  const jsonResponse = apiSuccess({
    content: clarifyContent,
    strategy: 'clarify',
    needsClarification: true,
    suggestedQuestions: classification.suggestedTools ?? [],
  });
  addRateLimitHeaders(jsonResponse.headers, rateLimitResult);
  return jsonResponse;
}

// ============================================================================
// Analytics API Routes
// ============================================================================

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      const days = parseInt(searchParams.get('days') ?? '30', 10);
      const stats = await agentAnalytics.getToolUsageStats(
        session.user.id,
        session.user.workspaceId ?? undefined,
        days
      );
      return apiSuccess(stats);
    }

    if (action === 'quality') {
      const days = parseInt(searchParams.get('days') ?? '30', 10);
      const quality = await agentAnalytics.getReasoningQualityMetrics(
        session.user.id,
        session.user.workspaceId ?? undefined,
        days
      );
      return apiSuccess(quality);
    }

    if (action === 'realtime') {
      const realtime = await agentAnalytics.getRealtimeStats(
        session.user.id,
        session.user.workspaceId ?? undefined
      );
      return apiSuccess(realtime);
    }

    return apiError('BAD_REQUEST', 'Invalid action', 400, {
      validActions: ['stats', 'quality', 'realtime'],
    });
  } catch (error: unknown) {
    logger.error('Failed to retrieve agent analytics', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return apiError('INTERNAL_ERROR', 'Failed to retrieve analytics', 500);
  }
}
