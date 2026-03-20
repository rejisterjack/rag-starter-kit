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
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
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

export function useApiKeys(): UseApiKeysReturn {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchApiKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/api-keys');
      if (!response.ok) throw new Error('Failed to fetch API keys');

      const data = await response.json();
      setApiKeys(data.apiKeys);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
      toast.error('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create API key');

      const result = await response.json();
      await fetchApiKeys();
      return result;
    },
    [fetchApiKeys]
  );

  const revokeKey = useCallback(
    async (keyId: string) => {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to revoke API key');
      await fetchApiKeys();
      toast.success('API key revoked');
    },
    [fetchApiKeys]
  );

  const regenerateKey = useCallback(
    async (keyId: string): Promise<{ key: string }> => {
      const response = await fetch(`/api/api-keys/${keyId}/regenerate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to regenerate API key');

      const result = await response.json();
      await fetchApiKeys();
      toast.success('API key regenerated');
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

      if (!response.ok) throw new Error('Failed to update API key');
      await fetchApiKeys();
      toast.success('API key updated');
    },
    [fetchApiKeys]
  );

  const getKeyUsage = useCallback(async (keyId: string, days = 30): Promise<ApiKeyUsage[]> => {
    const response = await fetch(`/api/api-keys/${keyId}?days=${days}`);
    if (!response.ok) throw new Error('Failed to fetch key usage');

    const data = await response.json();
    return data.usage;
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
