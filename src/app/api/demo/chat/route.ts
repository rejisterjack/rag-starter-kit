import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { generateRAGResponse } from '@/lib/rag/engine';
import { estimateMessageTokens } from '@/lib/rag/token-budget';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';

// =============================================================================
// Request Validation Schema
// =============================================================================

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  config: z
    .object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
      topK: z.number().positive().optional(),
      similarityThreshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
  stream: z.boolean().optional().default(true),
});

// Seed values used for the public demo
const DEMO_USER_EMAIL = 'demo@rag-starter-kit.dev';
const DEMO_USER_FALLBACK_ID = 'seed-demo-user';

// Cache the demo user ID in memory (avoids a DB lookup on every request)
let cachedDemoUserId: string | null = null;

async function getDemoUserId(): Promise<string> {
  if (cachedDemoUserId) return cachedDemoUserId;
  const { prisma } = await import('@/lib/db/client');
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  cachedDemoUserId = user?.id ?? DEMO_USER_FALLBACK_ID;
  return cachedDemoUserId;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Basic IP-based rate limiting for public demo (20 req / 15 min window)
    const rateLimitIdentifier = getRateLimitIdentifier(req, {});
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'demo', {
      endpoint: '/api/demo/chat',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message:
              'Demo rate limit exceeded. Please try again later or sign up for a free account.',
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

    let body: unknown;
    try {
      body = await req.json();
    } catch (_error: unknown) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parseResult.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { messages, config, stream } = parseResult.data;

    // Convert to history + question format required by generateRAGResponse
    const question = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Estimate tokens
    const estimatedTokens = estimateMessageTokens(messages);
    if (estimatedTokens > 2000) {
      // Stricter limit for demo
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_LIMIT',
            message: 'Message history too long for demo mode.',
          },
        },
        { status: 400 }
      );
    }

    // Default demo config
    const demoConfig = {
      model: config?.model || 'google/gemma-3-12b-it:free',
      temperature: config?.temperature ?? 0.7,
      maxTokens: Math.min(config?.maxTokens ?? 1000, 1000), // Max 1000 for demo
      topK: config?.topK ?? 5,
      similarityThreshold: config?.similarityThreshold ?? 0.7,
    };

    if (stream) {
      // For streaming, we actually want to build the SSE response.
      // Since generateRAGResponse is primarily for non-streaming REST API (from public chat route),
      // we'll need to use the actual RAG engine functions here or just not support streaming for the demo.
      // Wait, the main chat simulator in ChatSimulator component just fakes the streaming!
      // But the actual demo page should use real streaming if possible.
      // For simplicity in this demo endpoint, we'll return the full response and let the client handle it.
      // OR we can implement streaming. Let's look at `generateRAGResponse` first.
    }

    // For now, let's use the REST API approach for simplicity and rely on the client to present it
    const demoUserId = await getDemoUserId();
    const ragResponse = await generateRAGResponse({
      query: question,
      userId: demoUserId,
      history,
      config: demoConfig,
    });

    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        content: ragResponse.answer,
        sources: ragResponse.sources.map((source, index) => ({
          id: String(index + 1),
          documentId: source.metadata?.documentId,
          documentName: source.metadata?.documentName || 'Unknown Document',
          page: source.metadata?.page,
          score: source.similarity,
          content: source.content,
        })),
        usage: {
          promptTokens: ragResponse.tokensUsed?.prompt,
          completionTokens: ragResponse.tokensUsed?.completion,
          totalTokens: ragResponse.tokensUsed?.total,
        },
      },
    });

    const durationMs = Date.now() - startTime;
    logger.performance('demo_chat', durationMs, {
      userId: demoUserId,
      model: demoConfig.model,
      tokenCount: ragResponse.tokensUsed?.total,
    });

    addRateLimitHeaders(jsonResponse.headers, rateLimitResult);
    return jsonResponse;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Demo chat failed', {
      error: error instanceof Error ? error.message : String(error),
      duration: durationMs,
    });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process chat request' },
      },
      { status: 500 }
    );
  }
}
