/**
 * POST /api/chat/follow-up
 *
 * Given the last assistant message and (optionally) the preceding user query,
 * returns 2–3 short follow-up question suggestions.
 *
 * Suggestions are generated with a lightweight prompt against the configured
 * LLM provider and are always contextually relevant to the conversation.
 * Falls back to generic suggestions when the LLM is unavailable.
 */

import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defaultAIConfig } from '@/lib/ai';
import { auth } from '@/lib/auth';

const bodySchema = z.object({
  assistantMessage: z.string().min(1).max(8000),
  userQuery: z.string().max(1000).optional(),
  count: z.number().int().min(1).max(5).default(3),
});

/** Generic fallback questions when LLM is unavailable */
const FALLBACK_QUESTIONS = [
  'Can you elaborate on that?',
  'What are the key takeaways?',
  'How would this apply in practice?',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ questions: FALLBACK_QUESTIONS });
    }

    const { assistantMessage, userQuery, count } = parsed.data;

    // Auth check — if not authenticated (demo mode), return generic fallbacks
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ questions: FALLBACK_QUESTIONS });
    }

    // Build the follow-up generation prompt
    const systemContent = `You are a helpful assistant that generates concise follow-up questions.
Given an AI assistant's response, generate exactly ${count} short, specific follow-up questions a user might ask next.
Rules:
- Each question must be under 80 characters
- Questions should be directly related to the response content
- Questions should be curiosity-driven and actionable
- Output ONLY a JSON array of strings, no other text
- Example: ["What are the limitations?","How does this compare to X?","Can you give an example?"]`;

    const userContent = userQuery
      ? `User asked: "${userQuery}"\n\nAssistant responded:\n${assistantMessage.slice(0, 2000)}\n\nGenerate ${count} follow-up questions.`
      : `Assistant responded:\n${assistantMessage.slice(0, 2000)}\n\nGenerate ${count} follow-up questions.`;

    try {
      const result = await generateText({
        // biome-ignore lint/suspicious/noExplicitAny: openrouter SDK type mismatch with ai SDK
        model: openrouter(defaultAIConfig.model) as any,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        maxTokens: 300,
        temperature: 0.7,
      });

      const text = result.text?.trim() ?? '';
      // Extract the JSON array from the response
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const questions = JSON.parse(match[0]) as string[];
        const valid = questions
          .filter((q) => typeof q === 'string' && q.trim().length > 0)
          .slice(0, count)
          .map((q) => q.trim());
        if (valid.length > 0) {
          return NextResponse.json({ questions: valid });
        }
      }
    } catch {
      // LLM call failed — fall through to generic fallback
    }

    return NextResponse.json({ questions: FALLBACK_QUESTIONS });
  } catch {
    return NextResponse.json({ questions: FALLBACK_QUESTIONS });
  }
}
