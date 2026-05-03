/**
 * RAG Bot Product Chat API
 *
 * A dedicated endpoint for the RAG Bot product assistant on the homepage.
 * - Requires authentication (returns 401 with friendly message if not logged in)
 * - Uses free OpenRouter models with automatic fallback
 * - Streams responses via SSE
 * - Answers questions specifically about rag-starter-kit using embedded product knowledge
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';

// =============================================================================
// Product Knowledge Base (Embedded Context)
// This provides instant answers without requiring DB ingestion first.
// Later, this can be augmented with vector retrieval from ingested docs.
// =============================================================================

const PRODUCT_KNOWLEDGE = `You are RAG Bot, the official product assistant for rag-starter-kit.

ABOUT THE PRODUCT:
rag-starter-kit is a production-ready, TypeScript-native, self-hostable RAG (Retrieval-Augmented Generation) chatbot boilerplate. It is built entirely in TypeScript and Next.js, with zero required API costs by default (uses OpenRouter free LLMs and Google Gemini free embeddings).

KEY VALUE PROPOSITIONS:
1. TypeScript all the way down — no Python services needed
2. Zero-cost AI stack by default — OpenRouter free models + Google Gemini free embeddings
3. Production infrastructure already wired in — auth, file storage, background jobs, monitoring, rate limiting
4. Real-time and collaborative from the start — multi-user workspaces, typing indicators, presence tracking

TECH STACK:
- Next.js 15 with App Router + React 19
- Tailwind CSS 4 + shadcn/ui components
- PostgreSQL 16 + pgvector for vector storage
- Prisma 7 ORM
- Vercel AI SDK + LangChain.js
- OpenRouter (free LLMs: DeepSeek, Mistral, Llama, Gemma)
- Google Gemini (free embeddings: text-embedding-004)
- Inngest for background job processing
- Upstash Redis for rate limiting
- NextAuth.js v5 for authentication
- Cloudinary for file/document storage

CORE FEATURES:
- RAG pipeline: document ingestion → chunking → embedding → vector storage → retrieval → generation
- Real-time streaming responses via SSE
- Multi-user workspaces with RBAC
- Document upload (PDF, DOCX, TXT, MD) with background processing
- Voice input/output (Web Speech API + Whisper)
- Conversation branching/comparison
- PWA support (install as native app)
- Admin dashboard, analytics, audit logging
- SAML SSO support for enterprise
- API key management for programmatic access
- Embeddable chat widget
- Hybrid search (vector + full-text with RRF)
- Semantic caching for retrieval

DEPLOYMENT:
- One-click deploy to Vercel, Railway, or Render
- Full Docker Compose local stack available
- Self-hosted — your documents never leave your infrastructure

WHO IT'S FOR:
- Primary: TypeScript/Node.js developers building products who need AI chat on their own documents
- Secondary: Developers learning production RAG who want a real codebase
- Tertiary: Freelancers/agencies who need to ship client chatbots quickly

USE CASES:
1. Freelancer/agency: Client asks for AI chatbot trained on company docs. Clone, upload docs, configure two free API keys, deploy to Vercel. Done in a weekend instead of three weeks.
2. SaaS founder: Drowning in support tickets. Index docs and help articles. Support load drops automatically.
3. Internal tool: Years of knowledge scattered across Google Drive, Confluence. Index everything. New employees find answers instantly.
4. Learning: Developer wants to understand production RAG. Read the codebase to see how Inngest queues jobs, pgvector stores embeddings, SSE streams tokens.

PRICING:
- Open source (MIT License)
- Free to run in development and light production (OpenRouter free tier + Google Gemini free tier)
- No credit card required to get started

GETTING STARTED:
1. Clone the repository
2. Copy .env.example to .env and fill in two free API keys (OpenRouter + Google AI Studio)
3. Run docker-compose up for local PostgreSQL + Redis
4. npm install && npm run dev
5. Open http://localhost:3000 and start chatting

RULES FOR ANSWERING:
- Be friendly, professional, and enthusiastic about the product
- Answer based on the product knowledge provided above
- If a question is outside your knowledge, say "I don't have information about that yet. Check the full documentation or GitHub repo for more details."
- Cite specific features, files, or sections when relevant
- Keep answers concise but thorough (3-6 sentences for simple questions, longer for complex ones)
- Use markdown formatting when helpful (bullet points, code blocks, bold text)
- Always mention that the stack is free to run by default`;

// =============================================================================
// Configuration
// =============================================================================

const MODEL_FALLBACK_CHAIN = [
  'arcee-ai/trinity-large-preview:free',
  'stepfun/step-3.5-flash:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
];

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000, 'Message too long'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20, 'Too many history messages')
    .optional()
    .default([]),
});

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Please sign in to chat with RAG Bot',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'chat', {
      userId,
      endpoint: '/api/chat/product',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many messages. Please wait a moment.',
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

    // Step 3: Parse and validate request
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { message, history } = parseResult.data;

    // Step 4: Log chat message
    await logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      userId,
      metadata: {
        endpoint: '/api/chat/product',
        messageLength: message.length,
        historyLength: history.length,
      },
    });

    // Step 5: Prepare messages for LLM
    const messages = [
      { role: 'system' as const, content: PRODUCT_KNOWLEDGE },
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    // Step 6: Probe models and stream response
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    // Try to find a working model
    let usedModel = MODEL_FALLBACK_CHAIN[0];
    let probeOk = false;

    for (const modelName of MODEL_FALLBACK_CHAIN) {
      try {
        const openrouter = createOpenRouter({ apiKey: openrouterKey });
        await generateText({
          model: openrouter.chat(modelName),
          messages: [{ role: 'user', content: 'Hi' }],
          maxTokens: 1,
        });
        usedModel = modelName;
        probeOk = true;
        break;
      } catch (err) {
        logger.warn(`Model ${modelName} probe failed for product chat`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!probeOk) {
      return NextResponse.json(
        {
          error: 'All AI models are currently unavailable. Please try again in a moment.',
          code: 'MODEL_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    // Step 7: Stream response
    const openrouter = createOpenRouter({ apiKey: openrouterKey });
    const result = streamText({
      model: openrouter.chat(usedModel),
      messages,
      temperature: 0.5,
      maxTokens: 1500,
      onFinish: async (completion) => {
        // Log completion
        await logAuditEvent({
          event: AuditEvent.CHAT_MESSAGE_SENT,
          userId,
          metadata: {
            endpoint: '/api/chat/product',
            responseLength: completion.text.length,
            model: usedModel,
            latencyMs: Date.now() - startTime,
          },
        });
      },
    });

    const response = result.toTextStreamResponse({
      headers: {
        'X-Model-Used': usedModel,
        'X-RAG-Bot-Version': '1.0.0',
      },
    });

    addRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Product chat error', { error: errorMessage });

    return NextResponse.json(
      {
        error: 'Failed to generate response',
        code: 'INTERNAL_ERROR',
        details: errorMessage,
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
    name: 'RAG Bot Product Chat API',
    version: '1.0.0',
    description: 'Chat with RAG Bot — the official product assistant for rag-starter-kit',
    authentication: 'Requires session authentication (NextAuth.js)',
    endpoints: {
      'POST /api/chat/product': {
        description: 'Send a message to RAG Bot',
        body: {
          message: 'string (required) - Your question about the product',
          history: 'array (optional) - Previous messages for context',
        },
        response: 'SSE stream of text tokens',
      },
    },
    models: MODEL_FALLBACK_CHAIN,
  });
}
