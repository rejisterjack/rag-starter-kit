/**
 * React Hook for API Key Management — backed by TanStack Query
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { ApiError, apiClient } from '@/lib/api-client';
import { apiKeyKeys } from '@/lib/query-keys';

export interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  status: 'active' | 'revoked' | 'expired';
  permissions: string[];
  requestCount: number;
}

export interface ApiKeyUsage {
  date: string;
  requests: number;
  tokens: number;
  errors: number;
}

export interface UseApiKeysReturn {
  apiKeys: ApiKey[];
  isLoading: boolean;
  error: Error | null;

  // Actions
  createKey: (data: {
    name: string;
    description?: string;
    permissions: string[];
    expiresIn?: number;
  }) => Promise<{ key: string; keyId: string }>;
  revokeKey: (keyId: string) => Promise<void>;
  regenerateKey: (keyId: string) => Promise<{ key: string }>;
  updateKey: (keyId: string, data: { name?: string; permissions?: string[] }) => Promise<void>;

  // Usage
  getKeyUsage: (keyId: string, days?: number) => Promise<ApiKeyUsage[]>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useApiKeys(workspaceId?: string): UseApiKeysReturn {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: apiKeyKeys.list(workspaceId || ''),
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await apiClient<{ data: { apiKeys: ApiKey[] } }>(
        `/api/api-keys?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      return (data.data?.apiKeys || []) as ApiKey[];
    },
    enabled: !!workspaceId,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      permissions: string[];
      expiresIn?: number;
    }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const result = await apiClient<{
        data: { apiKey: { key: string; id: string } };
      }>('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, workspaceId }),
      });
      return { key: result.data.apiKey.key, keyId: result.data.apiKey.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(workspaceId || '') });
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create API key');
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await apiClient(`/api/api-keys/${keyId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(workspaceId || '') });
      toast.success('API key revoked successfully');
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to revoke API key');
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async (keyId: string): Promise<{ key: string }> => {
      const result = await apiClient<{ data: { key: string } }>(
        `/api/api-keys/${keyId}/regenerate`,
        { method: 'POST' }
      );
      return { key: result.data.key };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(workspaceId || '') });
      toast.success('API key regenerated successfully');
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to regenerate API key');
    },
  });

  const updateKeyMutation = useMutation({
    mutationFn: async ({
      keyId,
      data,
    }: {
      keyId: string;
      data: { name?: string; permissions?: string[] };
    }) => {
      await apiClient(`/api/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(workspaceId || '') });
      toast.success('API key updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update API key');
    },
  });

  const getKeyUsage = useCallback(async (keyId: string, days = 30): Promise<ApiKeyUsage[]> => {
    try {
      const data = await apiClient<{ data: { usage: ApiKeyUsage[] } }>(
        `/api/api-keys/${keyId}?days=${days}`
      );
      return data.data?.usage || [];
    } catch (err) {
      const error = err instanceof ApiError ? err : new Error(String(err));
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(workspaceId || '') });
  }, [queryClient, workspaceId]);

  return {
    apiKeys: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createKey: (data) => createKeyMutation.mutateAsync(data),
    revokeKey: (keyId) => revokeKeyMutation.mutateAsync(keyId),
    regenerateKey: (keyId) => regenerateKeyMutation.mutateAsync(keyId),
    updateKey: (keyId, data) => updateKeyMutation.mutateAsync({ keyId, data }),
    getKeyUsage,
    refresh,
  };
}

export default useApiKeys;
