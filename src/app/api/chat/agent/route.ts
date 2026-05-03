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
import { openrouter } from '@openrouter/ai-sdk-provider';
import { type LanguageModel, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { createOllama } from 'ollama-ai-provider';

const fireworks = createOpenAI({
  baseURL: 'https://api.fireworks.ai/inference/v1',
  apiKey: process.env.FIREWORKS_API_KEY,
});

import { createProviderFromEnv, type LLMMessage } from '@/lib/ai/llm';
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
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  model: 'meta-llama/llama-3.3-70b-instruct:free',
  embeddingModel: 'text-embedding-004',
};

const REACT_THRESHOLD = 0.6;

// Global analytics instance
const agentAnalytics = createAgentAnalytics();

function getModel(modelName: string): LanguageModel {
  // Fireworks models (accounts/fireworks/models/...)
  if (modelName.startsWith('accounts/fireworks/')) {
    return fireworks(modelName) as unknown as LanguageModel;
  }

  // OpenRouter models (contains '/' or ends with ':free')
  if (modelName.includes('/') || modelName.endsWith(':free')) {
    return openrouter.chat(modelName) as unknown as LanguageModel;
  }

  // OpenAI models
  if (modelName.startsWith('gpt-') || modelName.startsWith('text-')) {
    return openai(modelName) as unknown as LanguageModel;
  }

  // Ollama models
  const ollamaModels = ['llama3', 'mistral', 'phi3', 'gemma2', 'codellama', 'qwen'];
  if (ollamaModels.some((m) => modelName.toLowerCase().startsWith(m))) {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
    });
    return ollama(modelName) as unknown as LanguageModel;
  }

  // Default to OpenRouter for unknown models
  return openrouter.chat(modelName) as unknown as LanguageModel;
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
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
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
        return NextResponse.json(
          { error: 'Access denied to workspace', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in agent chat request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

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

    const router = createQueryRouter({
      model: config.model,
      temperature: 0.3,
    });

    const classificationStart = Date.now();
    const classification = await router.classify(userMessage, history);
    const classificationLatency = Date.now() - classificationStart;

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

    return NextResponse.json(
      {
        error: 'Failed to process agentic chat request',
        code: 'INTERNAL_ERROR',
        details: errorMessage,
        requestId,
      },
      { status: 500 }
    );
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
    const result = streamText({
      model: getModel(config.model),
      messages: llmMessages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
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

    const response = result.toTextStreamResponse({
      headers: {
        'X-Request-Id': requestId,
        'X-Strategy': 'direct_answer',
      },
    });
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

    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        content: response.content,
        strategy: 'direct_answer',
        usage: response.usage,
      },
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
    agentConfig,
    agentMemory,
    analytics,
  } = params;

  const tools: import('@/lib/rag/tools').Tool[] = [calculatorTool, currentTimeTool];

  if (agentConfig.enabledTools.includes('code_executor')) {
    tools.push(codeExecutorTool);
  }

  const agent = createReActAgent(tools, {
    model: config.model,
    maxSteps: agentConfig.maxIterations,
    enableReflection: agentConfig.enableReflection,
    earlyTermination: agentConfig.earlyTermination,
  });

  const result = await agent.execute(userMessage, {
    workspaceId: workspaceId ?? '',
    userId,
    history: history as unknown as import('@/types').Message[],
    memory: agentMemory,
    enablePlanning: agentConfig.enablePlanning,
  });

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

  // Track analytics
  await analytics.trackQuery({
    queryId: crypto.randomUUID(),
    userId,
    query: userMessage,
    queryType: 'calculate',
    strategy: 'calculate',
    success: true,
    steps: result.iterations,
    toolCalls: result.steps.filter((s: ReActStep) => s.action !== 'final_answer').length,
    latency: result.latency,
    tokensUsed: result.tokensUsed,
    toolUsage: { calculator: 1 },
    terminated: result.terminated,
    terminationReason: result.terminationReason,
    timestamp: new Date(),
  });

  return NextResponse.json({
    success: true,
    data: {
      content: result.answer,
      strategy: 'calculate',
      steps: agentConfig.showReasoning ? result.steps : undefined,
      iterations: result.iterations,
      terminated: result.terminated,
      terminationReason: result.terminationReason,
      latency: result.latency,
      usage: { totalTokens: result.tokensUsed },
    },
  });
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
    agentConfig,
    agentMemory,
    analytics,
  } = params;

  const webSearch = createWebSearchTool(getDefaultWebSearchProvider());
  const tools: import('@/lib/rag/tools').Tool[] = [webSearch, currentTimeTool];

  if (agentConfig.enabledTools.includes('calculator')) {
    tools.push(calculatorTool);
  }

  const agent = createReActAgent(tools, {
    model: config.model,
    maxSteps: agentConfig.maxIterations,
    enableReflection: agentConfig.enableReflection,
    earlyTermination: agentConfig.earlyTermination,
  });

  const result = await agent.execute(userMessage, {
    workspaceId: workspaceId ?? '',
    userId,
    history: history as unknown as import('@/types').Message[],
    memory: agentMemory,
    enablePlanning: agentConfig.enablePlanning,
  });

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

  // Track analytics
  await analytics.trackQuery({
    queryId: crypto.randomUUID(),

    userId,
    query: userMessage,
    queryType: 'web_search',
    strategy: 'web_search',
    success: true,
    steps: result.iterations,
    toolCalls: result.steps.filter((s: ReActStep) => s.action !== 'final_answer').length,
    latency: result.latency,
    tokensUsed: result.tokensUsed,
    toolUsage: { web_search: 1 },
    terminated: result.terminated,
    terminationReason: result.terminationReason,
    timestamp: new Date(),
  });

  return NextResponse.json({
    success: true,
    data: {
      content: result.answer,
      strategy: 'web_search',
      steps: agentConfig.showReasoning ? result.steps : undefined,
      sources: result.sources,
      iterations: result.iterations,
      terminated: result.terminated,
      terminationReason: result.terminationReason,
      latency: result.latency,
      usage: { totalTokens: result.tokensUsed },
    },
  });
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
    const result = streamText({
      model: getModel(config.model),
      messages: llmMessages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
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

    const response = result.toTextStreamResponse({
      headers: {
        'X-Request-Id': requestId,
        'X-Strategy': 'direct_retrieval',
        'X-Message-Sources': JSON.stringify(sourcesMetadata),
      },
    });
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

    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        content: response.content,
        strategy: 'direct_retrieval',
        sources: citations,
        usage: response.usage,
      },
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
    history: _history,
    userId,
    workspaceId,
    effectiveConversationId,
    config,
    agentConfig,
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

    return NextResponse.json(
      {
        success: false,
        data: {
          content: partialAnswer,
          strategy: 'react',
          error: errorMessage,
          iterations: 0,
          terminated: true,
          terminationReason: `Agent execution error: ${errorMessage}`,
        },
      },
      {
        headers: {
          'X-Agent-Tools-Used': '0',
          'X-Agent-Iterations': '0',
        },
      }
    );
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

  const jsonResponse = NextResponse.json({
    success: true,
    data: {
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
    },
  });

  // Include agent execution metadata in response headers
  jsonResponse.headers.set('X-Agent-Tools-Used', toolNamesUsed.join(','));
  jsonResponse.headers.set('X-Agent-Iterations', String(result.iterations));

  return jsonResponse;
}

async function handleClarification(
  params: Omit<HandlerParams, 'config' | 'shouldStream' | 'shouldStreamReasoning' | 'startTime'> & {
    classification: QueryClassification;
  }
): Promise<Response> {
  const { userMessage, classification, effectiveConversationId, rateLimitResult, analytics } =
    params;

  const memory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await memory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
    await memory.addMessage(effectiveConversationId, {
      role: 'assistant',
      content: classification.reasoning,
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

  const jsonResponse = NextResponse.json({
    success: true,
    data: {
      content: classification.reasoning,
      strategy: 'clarify',
      needsClarification: true,
      suggestedQuestions: classification.suggestedTools ?? [],
    },
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ success: true, data: stats });
    }

    if (action === 'quality') {
      const days = parseInt(searchParams.get('days') ?? '30', 10);
      const quality = await agentAnalytics.getReasoningQualityMetrics(
        session.user.id,
        session.user.workspaceId ?? undefined,
        days
      );
      return NextResponse.json({ success: true, data: quality });
    }

    if (action === 'realtime') {
      const realtime = await agentAnalytics.getRealtimeStats(
        session.user.id,
        session.user.workspaceId ?? undefined
      );
      return NextResponse.json({ success: true, data: realtime });
    }

    return NextResponse.json(
      { error: 'Invalid action', validActions: ['stats', 'quality', 'realtime'] },
      { status: 400 }
    );
  } catch (error: unknown) {
    logger.error('Failed to retrieve agent analytics', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Failed to retrieve analytics' }, { status: 500 });
  }
}
