import { z } from 'zod';

// =============================================================================
// Document Upload Schema
// =============================================================================

export const documentUploadSchema = z.object({
  workspaceId: z.string().min(1),
  files: z
    .array(
      z.object({
        name: z.string().min(1),
        size: z.number().max(50 * 1024 * 1024, 'File size exceeds 50MB limit'),
        type: z.enum([
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/markdown',
          'text/html',
        ]),
      })
    )
    .min(1),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

// =============================================================================
// Chat Message Schema
// =============================================================================

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  workspaceId: z.string().min(1),
  documentIds: z.array(z.string()).optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// =============================================================================
// Create Workspace Schema
// =============================================================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

// =============================================================================
// Invite Member Schema
// =============================================================================

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// =============================================================================
// Server Action Schemas
// =============================================================================

export const createChatSchema = z.object({
  title: z.string().max(200).optional(),
  model: z.string().max(50).optional(),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;

export const deleteChatSchema = z.object({
  chatId: z.string().uuid(),
});

export type DeleteChatInput = z.infer<typeof deleteChatSchema>;

export const updateChatTitleSchema = z.object({
  chatId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

export type UpdateChatTitleInput = z.infer<typeof updateChatTitleSchema>;

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  callbackUrl: z.string().optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(100).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
