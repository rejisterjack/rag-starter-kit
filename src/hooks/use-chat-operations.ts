/**
 * Chat creation and feedback mutations — backed by TanStack Query
 */

'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, apiClient } from '@/lib/api-client';

interface CreateChatResponse {
  success: boolean;
  data?: { chat?: { id?: string } };
  error?: string;
  details?: string;
}

export function useCreateChat() {
  return useMutation({
    mutationFn: async ({ title, model }: { title: string; model: string }) => {
      const data = await apiClient<CreateChatResponse>('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, model }),
      });
      if (!data.success) {
        throw new ApiError(data.details || data.error || 'Failed to create chat', 400);
      }
      return data.data?.chat?.id as string;
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create new chat');
    },
  });
}

export function useSendFeedback() {
  return useMutation({
    mutationFn: async ({ messageId, rating }: { messageId: string; rating: 'up' | 'down' }) => {
      await apiClient(`/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
    },
  });
}
