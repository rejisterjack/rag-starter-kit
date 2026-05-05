/**
 * Vision Chat API
 *
 * Handles multi-modal chat with vision-language models.
 * Supports text + image inputs for comprehensive document understanding.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { type CoreMessage, generateText, type LanguageModel, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ConversationMemory } from '@/lib/rag/memory';
import { searchByImage, searchImagesByText } from '@/lib/rag/retrieval';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

/**
 * Request body validation
 */
interface VisionChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  chatId?: string;
  image?: string; // Base64 encoded image
  imageUrl?: string; // URL to image
  stream?: boolean;
  config?: {
    temperature?: number;
    maxTokens?: number;
    topK?: number;
    enableRetrieval?: boolean;
  };
}

/**
 * POST /api/chat/vision
 * Vision-language chat endpoint
 */
export async function POST(req: Request) {
  try {
    // Step 1: Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'chat', {
      userId,
      workspaceId,
      endpoint: '/api/chat/vision',
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

    // Step 3: Parse request body
    const body = (await req.json()) as VisionChatRequest;
    const { messages, chatId, image, imageUrl, stream: shouldStream, config } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Messages are required' } },
        { status: 400 }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || '';

    // Validate workspace access
    if (workspaceId) {
      const hasAccess = await checkPermission(userId, workspaceId, Permission.READ_DOCUMENTS);
      if (!hasAccess) {
        await logAuditEvent({
          event: AuditEvent.PERMISSION_DENIED,
          userId,
          workspaceId,
          metadata: {
            action: 'vision_chat',
            requiredPermission: Permission.READ_DOCUMENTS,
          },
          severity: 'WARNING',
        });

        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to workspace' } },
          { status: 403 }
        );
      }
    }

    // Step 4: Retrieve image-based context if enabled
    let imageContext: string | undefined;
    let retrievedImages: Array<{
      id: string;
      documentName: string;
      storageUrl: string;
      caption?: string;
      pageNumber?: number;
    }> = [];

    if (config?.enableRetrieval !== false && (image || imageUrl || userMessage)) {
      try {
        if (image || imageUrl) {
          // Search by the provided image
          const queryImage = image ? base64ToBuffer(image) : (imageUrl as string);
          const searchResults = await searchByImage(queryImage, workspaceId || userId, {
            topK: config?.topK || 3,
            includeChunks: true,
          });

          if (searchResults.images.length > 0) {
            retrievedImages = searchResults.images.map((img) => ({
              id: img.id,
              documentName: img.documentName,
              storageUrl: img.storageUrl,
              caption: img.caption,
              pageNumber: img.pageNumber,
            }));
            imageContext = buildImageContext(searchResults.images, searchResults.chunks);
          }
        } else {
          // Search by text query for relevant images
          const searchResults = await searchImagesByText(userMessage, workspaceId || userId, {
            topK: config?.topK || 3,
            includeChunks: true,
          });

          if (searchResults.images.length > 0) {
            retrievedImages = searchResults.images.map((img) => ({
              id: img.id,
              documentName: img.documentName,
              storageUrl: img.storageUrl,
              caption: img.caption,
              pageNumber: img.pageNumber,
            }));
            imageContext = buildImageContext(searchResults.images, searchResults.chunks);
          }
        }
      } catch (error: unknown) {
        logger.debug('Image context retrieval failed, continuing without image context', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Step 5: Build system prompt and prepare messages
    const systemPrompt = buildVisionSystemPrompt(imageContext);
    const visionMessages = prepareVisionMessages(messages, image, imageUrl, systemPrompt);

    // Step 7: Log chat message
    await logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      userId,
      workspaceId,
      metadata: {
        chatId,
        messageLength: userMessage.length,
        hasImage: !!(image || imageUrl),
        hasImageContext: !!imageContext,
        retrievedImages: retrievedImages.length,
      },
    });

    // Step 8: Generate response
    const visionModel = getVisionModel();
    const coreMessages = visionMessages as CoreMessage[];

    if (shouldStream) {
      const result = streamText({
        model: visionModel,
        messages: coreMessages,
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxTokens ?? 2000,
      });

      const sourcesMetadata = retrievedImages.map((img) => ({
        id: img.id,
        documentName: img.documentName,
        storageUrl: img.storageUrl,
        pageNumber: img.pageNumber,
      }));

      const response = result.toTextStreamResponse({
        headers: {
          'X-Retrieved-Images': JSON.stringify(sourcesMetadata),
          'X-Model-Used': 'gemini-1.5-flash',
        },
      });

      addRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    } else {
      const result = await generateText({
        model: visionModel,
        messages: coreMessages,
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxTokens ?? 2000,
      });

      // Save to conversation history
      if (chatId) {
        const memory = new ConversationMemory(prisma);
        await memory.addMessage(chatId, {
          role: 'user',
          content: userMessage,
        });
        await memory.addMessage(chatId, {
          role: 'assistant',
          content: result.text,
        });
      }

      const jsonResponse = NextResponse.json({
        success: true,
        data: {
          content: result.text,
          retrievedImages: retrievedImages.map((img) => ({
            id: img.id,
            documentName: img.documentName,
            storageUrl: img.storageUrl,
            pageNumber: img.pageNumber,
          })),
          usage: {
            promptTokens: result.usage?.promptTokens ?? 0,
            completionTokens: result.usage?.completionTokens ?? 0,
            totalTokens: result.usage?.totalTokens ?? 0,
          },
          model: 'gemini-1.5-flash',
        },
      });

      addRateLimitHeaders(jsonResponse.headers, rateLimitResult);
      return jsonResponse;
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process request',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Convert base64 string to buffer
 */
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Get the vision model — typed wrapper to avoid `as any` casts
 */
function getVisionModel(): LanguageModel {
  const googleAI = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  return googleAI('gemini-1.5-flash') as unknown as LanguageModel;
}

/**
 * Build system prompt with image context
 */
function buildVisionSystemPrompt(imageContext?: string): string {
  let prompt = `You are a helpful AI assistant that can analyze images and answer questions about them.

You have access to vision capabilities and can understand visual content including:
- Charts, graphs, and data visualizations
- Diagrams and technical drawings
- Screenshots and UI elements
- Photos and scanned documents
- Tables and structured data

Guidelines:
- Describe images in detail when asked
- Answer questions specifically about the visual content
- Reference relevant text from the document context when available
- If you can't see something clearly, say so
- Be precise about what you observe in images`;

  if (imageContext) {
    prompt += `\n\nRetrieved document context that may be relevant:\n${imageContext}`;
  }

  return prompt;
}

/**
 * Prepare messages for vision model
 */
function prepareVisionMessages(
  messages: Array<{ role: string; content: string }>,
  image: string | undefined,
  imageUrl: string | undefined,
  systemPrompt: string
): Array<{ role: 'user' | 'assistant' | 'system'; content: unknown }> {
  const visionMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: unknown }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of messages.slice(0, -1)) {
    visionMessages.push({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    });
  }

  // Add the current message with image if provided
  const currentMessage = messages[messages.length - 1];
  if (currentMessage) {
    if (image || imageUrl) {
      const imageData = image || imageUrl;
      visionMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: currentMessage.content },
          { type: 'image', image: imageData },
        ],
      });
    } else {
      visionMessages.push({
        role: 'user',
        content: currentMessage.content,
      });
    }
  }

  return visionMessages;
}

/**
 * Build context string from retrieved images and chunks
 */
function buildImageContext(
  images: Array<{
    documentName: string;
    caption?: string;
    ocrText?: string;
    pageNumber?: number;
  }>,
  chunks: Array<{ content: string; metadata: { documentName: string; page?: number } }>
): string {
  const sections: string[] = [];

  if (images.length > 0) {
    sections.push('Retrieved Images:');
    images.forEach((img, idx) => {
      sections.push(
        `[Image ${idx + 1}] ${img.documentName}${img.pageNumber ? ` (Page ${img.pageNumber})` : ''}`
      );
      if (img.caption) {
        sections.push(`Description: ${img.caption}`);
      }
      if (img.ocrText) {
        sections.push(`OCR Text: ${img.ocrText}`);
      }
    });
  }

  if (chunks.length > 0) {
    sections.push('\nRelated Document Content:');
    chunks.forEach((chunk, idx) => {
      sections.push(
        `[Source ${idx + 1}] ${chunk.metadata.documentName}${chunk.metadata.page ? `, Page ${chunk.metadata.page}` : ''}`
      );
      sections.push(chunk.content);
    });
  }

  return sections.join('\n\n');
}
