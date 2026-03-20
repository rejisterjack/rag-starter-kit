/**
 * React Hook for Conversation Branching
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

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
  branchA: ConversationBranch & { messages: Array<{id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: Date}> };
  branchB: ConversationBranch & { messages: Array<{id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: Date}> };
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
  const [branches, setBranches] = useState<ConversationBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<ConversationBranch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/branch?conversationId=${options.conversationId}`);
      if (!response.ok) throw new Error('Failed to fetch branches');
      
      const data = await response.json();
      setBranches(data.branches);
      setCurrentBranch(data.branches.find((b: ConversationBranch) => b.isActive) || null);
    } catch (err) {
      setError(err as Error);
      toast.error('Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  }, [options.conversationId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const forkConversation = useCallback(async (messageId: string, name?: string): Promise<ConversationBranch> => {
    const response = await fetch('/api/chat/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: options.conversationId,
        messageId,
        name: name || `Branch ${branches.length + 1}`,
      }),
    });

    if (!response.ok) throw new Error('Failed to create branch');
    
    const data = await response.json();
    await fetchBranches();
    toast.success('Branch created');
    return data.branch;
  }, [options.conversationId, branches.length, fetchBranches]);

  const switchBranch = useCallback(async (branchId: string) => {
    const response = await fetch('/api/chat/branch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: options.conversationId,
        branchId,
        action: 'switch',
      }),
    });

    if (!response.ok) throw new Error('Failed to switch branch');
    
    await fetchBranches();
    const branch = branches.find((b) => b.id === branchId);
    if (branch) {
      options.onBranchChange?.(branch);
    }
    toast.success('Switched branch');
  }, [options, branches, fetchBranches]);

  const renameBranch = useCallback(async (branchId: string, name: string) => {
    const response = await fetch('/api/chat/branch', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, name }),
    });

    if (!response.ok) throw new Error('Failed to rename branch');
    await fetchBranches();
    toast.success('Branch renamed');
  }, [fetchBranches]);

  const deleteBranch = useCallback(async (branchId: string) => {
    const response = await fetch(`/api/chat/branch?branchId=${branchId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to delete branch');
    await fetchBranches();
    toast.success('Branch deleted');
  }, [fetchBranches]);

  const compareBranches = useCallback(async (branchAId: string, branchBId: string): Promise<BranchComparison> => {
    const response = await fetch(`/api/chat/branch/compare?branchA=${branchAId}&branchB=${branchBId}`);
    if (!response.ok) throw new Error('Failed to compare branches');
    
    const data = await response.json();
    return data.comparison;
  }, []);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const response = await fetch('/api/chat/branch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: options.conversationId,
        messageId,
        newContent,
        action: 'edit',
      }),
    });

    if (!response.ok) throw new Error('Failed to edit message');
    toast.success('Message updated');
  }, [options.conversationId]);

  return {
    branches,
    currentBranch,
    isLoading,
    error,
    forkConversation,
    switchBranch,
    renameBranch,
    deleteBranch,
    compareBranches,
    editMessage,
    refreshBranches: fetchBranches,
  };
}

export default useConversationBranch;
