/**
 * React Hook for API Key Management
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

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
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchApiKeys = useCallback(async () => {
    if (!workspaceId) {
      setApiKeys([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/api-keys?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to fetch API keys');
      }

      const data = await response.json();
      // Transform the API response to match our interface
      const transformedKeys: ApiKey[] =
        data.data?.apiKeys?.map((key: ApiKey) => ({
          ...key,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
        })) || [];
      setApiKeys(transformedKeys);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
      toast.error(fetchError.message || 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const createKey = useCallback(
    async (data: {
      name: string;
      description?: string;
      permissions: string[];
      expiresIn?: number;
    }): Promise<{ key: string; keyId: string }> => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }

      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          workspaceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to create API key');
      }

      const result = await response.json();
      await fetchApiKeys();
      return {
        key: result.data?.apiKey?.key,
        keyId: result.data?.apiKey?.id,
      };
    },
    [fetchApiKeys, workspaceId]
  );

  const revokeKey = useCallback(
    async (keyId: string) => {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to revoke API key');
      }

      await fetchApiKeys();
      toast.success('API key revoked successfully');
    },
    [fetchApiKeys]
  );

  const regenerateKey = useCallback(
    async (keyId: string): Promise<{ key: string }> => {
      const response = await fetch(`/api/api-keys/${keyId}/regenerate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to regenerate API key');
      }

      const result = await response.json();
      await fetchApiKeys();
      toast.success('API key regenerated successfully');
      return result;
    },
    [fetchApiKeys]
  );

  const updateKey = useCallback(
    async (keyId: string, data: { name?: string; permissions?: string[] }) => {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to update API key');
      }

      await fetchApiKeys();
      toast.success('API key updated successfully');
    },
    [fetchApiKeys]
  );

  const getKeyUsage = useCallback(async (keyId: string, days = 30): Promise<ApiKeyUsage[]> => {
    const response = await fetch(`/api/api-keys/${keyId}?days=${days}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error?.message || 'Failed to fetch key usage');
    }

    const data = await response.json();
    return data.data?.usage || [];
  }, []);

  return {
    apiKeys,
    isLoading,
    error,
    createKey,
    revokeKey,
    regenerateKey,
    updateKey,
    getKeyUsage,
    refresh: fetchApiKeys,
  };
}

export default useApiKeys;
