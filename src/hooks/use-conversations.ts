/**
 * Offline-aware conversations hook
 * Caches conversation lists in IndexedDB for offline access
 */

'use client';

import type { ConversationSummary } from '@/components/chat/conversation-history-list';
import { useOfflineQuery } from '@/hooks/use-offline-query';

export interface UseConversationsOptions {
  limit?: number;
  enabled?: boolean;
}

export function useConversations(options: UseConversationsOptions = {}) {
  const { limit = 50, enabled = true } = options;

  return useOfflineQuery<ConversationSummary[]>({
    key: `conversations:list:${limit}`,
    fetcher: async () => {
      const response = await fetch(`/api/chats?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const json = await response.json();
      const payload = json?.data?.items;
      return (Array.isArray(payload) ? payload : []) as ConversationSummary[];
    },
    ttl: 2 * 60 * 1000, // 2 minutes
    staleWhileRevalidate: true,
    enabled,
  });
}
