/**
 * React Hook for Conversation Branching — backed by TanStack Query
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { branchKeys } from '@/lib/query-keys';

export interface ConversationBranch {
  id: string;
  name: string;
  parentId: string | null;
  conversationId: string;
  messageCount: number;
  createdAt: Date;
  isActive: boolean;
}

export interface BranchTreeNode extends ConversationBranch {
  children: BranchTreeNode[];
  depth: number;
}

export interface BranchComparison {
  branchA: ConversationBranch & {
    messages: Array<{
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      createdAt: Date;
    }>;
  };
  branchB: ConversationBranch & {
    messages: Array<{
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      createdAt: Date;
    }>;
  };
  divergencePoint: string | null;
  differences: Array<{
    messageIndex: number;
    type: 'added' | 'removed' | 'modified';
    contentA?: string;
    contentB?: string;
  }>;
}

export interface UseConversationBranchReturn {
  branches: ConversationBranch[];
  currentBranch: ConversationBranch | null;
  isLoading: boolean;
  error: Error | null;

  // Actions
  forkConversation: (messageId: string, name?: string) => Promise<ConversationBranch>;
  switchBranch: (branchId: string) => Promise<void>;
  renameBranch: (branchId: string, name: string) => Promise<void>;
  deleteBranch: (branchId: string) => Promise<void>;
  compareBranches: (branchAId: string, branchBId: string) => Promise<BranchComparison>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;

  // Refresh
  refreshBranches: () => Promise<void>;
}

export interface UseConversationBranchOptions {
  conversationId: string;
  onBranchChange?: (branch: ConversationBranch) => void;
}

export function useConversationBranch(
  options: UseConversationBranchOptions
): UseConversationBranchReturn {
  const queryClient = useQueryClient();
  const { conversationId, onBranchChange } = options;

  const query = useQuery({
    queryKey: branchKeys.list(conversationId),
    queryFn: async () => {
      const data = await apiClient<{ branches: ConversationBranch[] }>(
        `/api/chat/branch?conversationId=${conversationId}`
      );
      return data.branches;
    },
    enabled: !!conversationId,
  });

  const currentBranch = query.data?.find((b) => b.isActive) || null;

  const forkMutation = useMutation({
    mutationFn: async ({ messageId, name }: { messageId: string; name?: string }) => {
      const data = await apiClient<{ branch: ConversationBranch }>('/api/chat/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          messageId,
          name: name || `Branch ${(query.data?.length || 0) + 1}`,
        }),
      });
      return data.branch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.list(conversationId) });
      toast.success('Branch created');
    },
    onError: () => {
      toast.error('Failed to create branch');
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      await apiClient('/api/chat/branch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, branchId, action: 'switch' }),
      });
      return branchId;
    },
    onSuccess: (branchId) => {
      queryClient.invalidateQueries({ queryKey: branchKeys.list(conversationId) });
      const branch = query.data?.find((b) => b.id === branchId);
      if (branch) onBranchChange?.(branch);
      toast.success('Switched branch');
    },
    onError: () => {
      toast.error('Failed to switch branch');
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ branchId, name }: { branchId: string; name: string }) => {
      await apiClient('/api/chat/branch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.list(conversationId) });
      toast.success('Branch renamed');
    },
    onError: () => {
      toast.error('Failed to rename branch');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (branchId: string) => {
      await apiClient(`/api/chat/branch?branchId=${branchId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.list(conversationId) });
      toast.success('Branch deleted');
    },
    onError: () => {
      toast.error('Failed to delete branch');
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ messageId, newContent }: { messageId: string; newContent: string }) => {
      await apiClient('/api/chat/branch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messageId, newContent, action: 'edit' }),
      });
    },
    onSuccess: () => {
      toast.success('Message updated');
    },
    onError: () => {
      toast.error('Failed to edit message');
    },
  });

  const compareBranches = useCallback(
    async (branchAId: string, branchBId: string): Promise<BranchComparison> => {
      const data = await apiClient<{ comparison: BranchComparison }>(
        `/api/chat/branch/compare?branchA=${branchAId}&branchB=${branchBId}`
      );
      return data.comparison;
    },
    []
  );

  const refreshBranches = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: branchKeys.list(conversationId) });
  }, [queryClient, conversationId]);

  return {
    branches: query.data || [],
    currentBranch,
    isLoading: query.isLoading,
    error: query.error,
    forkConversation: (messageId, name) => forkMutation.mutateAsync({ messageId, name }),
    switchBranch: async (branchId) => {
      await switchMutation.mutateAsync(branchId);
    },
    renameBranch: (branchId, name) => renameMutation.mutateAsync({ branchId, name }),
    deleteBranch: (branchId) => deleteMutation.mutateAsync(branchId),
    compareBranches,
    editMessage: (messageId, newContent) => editMutation.mutateAsync({ messageId, newContent }),
    refreshBranches,
  };
}

export default useConversationBranch;
