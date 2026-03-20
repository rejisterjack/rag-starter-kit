/**
 * Agentic Chat API Route with Streaming Support
 * Uses Query Router + ReAct Agent + Multi-Step Reasoning for intelligent query handling
 */

import { openai } from '@ai-sdk/openai';
import { type LanguageModel, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { createOllama } from 'ollama-ai-provider';
import { createProviderFromEnv, type LLMMessage } from '@/lib/ai/llm';
import { MetricType, recordMetric } from '@/lib/analytics/rag-metrics';
import { trackTokenUsage } from '@/lib/analytics/token-tracking';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
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
  createWebSearchTool,
  getDefaultWebSearchProvider,
  currentTimeTool,
  documentSummaryTool,
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
  model: 'gpt-4o-mini',
  embeddingModel: 'text-embedding-3-small',
};

const REACT_THRESHOLD = 0.6;

function getModel(modelName: string): LanguageModel {
  if (modelName.startsWith('gpt-') || modelName.startsWith('text-')) {
    return openai(modelName) as unknown as LanguageModel;
  }
  const ollamaModels = ['llama3', 'mistral', 'phi3', 'gemma2', 'codellama'];
  if (ollamaModels.some((m) => modelName.startsWith(m))) {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
    });
    return ollama(modelName) as unknown as LanguageModel;
  }
  return openai(modelName) as unknown as LanguageModel;
}

interface HandlerParams {
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: string;
  workspaceId: string | undefined;
  effectiveConversationId: string | undefined;
  config: RAGConfig;
  shouldStream: boolean;
  rateLimitResult: { success: boolean; limit: number; remaining: number; reset: number };
  requestId: string;
  startTime: number;
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
    } catch {
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
    const config = { ...defaultConfig, ...userConfig };
    const effectiveConversationId = conversationId ?? chatId;
    const userMessage = messages[messages.length - 1].content;

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
          shouldStream,
          rateLimitResult,
          requestId,
          startTime,
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
          shouldStream,
          rateLimitResult,
          requestId,
          startTime,
          classification,
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
          shouldStream,
          rateLimitResult,
          requestId,
          startTime,
          classification,
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
            shouldStream,
            rateLimitResult,
            requestId,
            startTime,
            classification,
          });
        } else {
          response = await handleDirectRetrieval({
            userMessage,
            history,
            userId,
            workspaceId,
            effectiveConversationId,
            config,
            shouldStream,
            rateLimitResult,
            requestId,
            startTime,
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
          rateLimitResult,
          requestId,
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
          shouldStream,
          rateLimitResult,
          requestId,
          startTime,
          classification,
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
  } = params;

  const llmProvider = createProviderFromEnv();
  const memory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await memory.addMessage(effectiveConversationId, {
      role: 'user',
      content: userMessage,
    });
  }

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: 'You are a helpful assistant. Answer directly and concisely.' },
    ...history,
    { role: 'user', content: userMessage },
  ];

  if (shouldStream) {
    const result = streamText({
      model: getModel(config.model),
      messages: llmMessages,
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
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
          promptTokens: completion.usage?.inputTokens ?? 0,
          completionTokens: completion.usage?.outputTokens ?? 0,
          model: config.model,
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
  const { userMessage, history, userId, workspaceId, effectiveConversationId, config } = params;

  const agent = createReActAgent([calculatorTool, currentTimeTool], {
    model: config.model,
  });

  const result = await agent.execute(userMessage, {
    workspaceId: workspaceId ?? '',
    userId,
    history: history as unknown as import('@/types').Message[],
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

  return NextResponse.json({
    success: true,
    data: {
      content: result.answer,
      strategy: 'calculate',
      steps: result.steps,
      latency: result.latency,
      usage: { totalTokens: result.tokensUsed },
    },
  });
}

async function handleWebSearch(
  params: HandlerParams & { classification: QueryClassification }
): Promise<Response> {
  const { userMessage, history, userId, workspaceId, effectiveConversationId, config } = params;

  const webSearch = createWebSearchTool(getDefaultWebSearchProvider());
  const agent = createReActAgent([webSearch, currentTimeTool], {
    model: config.model,
  });

  const result = await agent.execute(userMessage, {
    workspaceId: workspaceId ?? '',
    userId,
    history: history as unknown as import('@/types').Message[],
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

  return NextResponse.json({
    success: true,
    data: {
      content: result.answer,
      strategy: 'web_search',
      steps: result.steps,
      sources: result.sources,
      latency: result.latency,
      usage: { totalTokens: result.tokensUsed },
    },
  });
}

async function handleDirectRetrieval(params: HandlerParams): Promise<Response> {
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
  } = params;

  const { retrieveSources } = await import('@/lib/rag/retrieval');
  const sources = await retrieveSources(userMessage, userId, config);

  const citationHandler = new CitationHandler();
  const chunks = sourcesToChunks(sources);
  const { context, citationMap } = citationHandler.formatContextWithCitations(chunks);

  const { buildSystemPromptWithContext } = await import('@/lib/ai/prompts/templates');
  const systemPrompt = buildSystemPromptWithContext(context, {
    style: config.temperature < 0.5 ? 'concise' : 'balanced',
  });

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
      maxOutputTokens: config.maxTokens,
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
          promptTokens: completion.usage?.inputTokens ?? 0,
          completionTokens: completion.usage?.outputTokens ?? 0,
          model: config.model,
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
  } = params;

  const tools = [calculatorTool, searchDocumentsTool, documentSummaryTool, currentTimeTool];

  try {
    const webSearch = createWebSearchTool(getDefaultWebSearchProvider());
    tools.push(webSearch);
  } catch {
    // Web search not configured
  }

  const agent = createReActAgent(tools, {
    model: config.model,
  });

  const result = await agent.execute(userMessage, {
    workspaceId: workspaceId ?? '',
    userId,
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

  return NextResponse.json({
    success: true,
    data: {
      content: result.answer,
      strategy: 'react',
      steps: result.steps,
      sources: result.sources,
      toolCalls: result.steps.filter((s: ReActStep) => s.action).length,
      latency: result.latency,
      usage: { totalTokens: result.tokensUsed },
    },
  });
}

async function handleClarification(
  params: Omit<HandlerParams, 'config' | 'shouldStream' | 'startTime'> & {
    classification: QueryClassification;
  }
): Promise<Response> {
  const { userMessage, classification, effectiveConversationId, rateLimitResult } = params;

  const memory = new ConversationMemory(prisma);

  if (effectiveConversationId) {
    await memory.addMessage(effectiveConversationId, { role: 'user', content: userMessage });
    await memory.addMessage(effectiveConversationId, {
      role: 'assistant',
      content: classification.reasoning,
    });
  }

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
