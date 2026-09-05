import { z } from 'zod';

export const publicChatHistorySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const publicChatRequestSchema = z.object({
  question: z.string().min(1, 'Question is required').max(4000, 'Question too long'),
  workspaceId: z.string().min(1, 'Workspace ID cannot be empty').optional(),
  conversationId: z.string().optional(),
  history: z.array(publicChatHistorySchema).optional(),
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

export const publicIngestRequestSchema = z.object({
  url: z.string().url(),
  metadata: z.record(z.unknown()).optional(),
});

export type PublicChatRequest = z.infer<typeof publicChatRequestSchema>;
export type PublicIngestRequest = z.infer<typeof publicIngestRequestSchema>;

export type PublicChatStreamEvent =
  | { type: 'sources'; citations: Array<Record<string, unknown>> }
  | { type: 'content'; content: string }
  | { type: 'done'; metadata?: Record<string, unknown> }
  | { type: 'error'; message: string };
