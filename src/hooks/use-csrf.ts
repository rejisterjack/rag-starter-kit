/**
 * CSRF Token Hook
 *
 * Provides CSRF token management for client-side API calls.
 */

import { useCallback, useEffect, useState } from 'react';

interface UseCsrfReturn {
  token: string | null;
  isLoading: boolean;
  error: Error | null;
  refreshToken: () => Promise<void>;
  fetchWithCsrf: (url: string, options?: RequestInit) => Promise<Response>;
}

/**
 * Hook for managing CSRF tokens
 */
export function useCsrf(): UseCsrfReturn {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch a new CSRF token from the server
   */
  const refreshToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/csrf/token');

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();

      if (data.token) {
        setToken(data.token);
        // Also store in meta tag for global access
        updateMetaTag(data.token);
      } else {
        throw new Error('No token in response');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch with CSRF token automatically included
   */
  const fetchWithCsrf = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const currentToken = token || getCsrfTokenFromMeta();

      // If no token and it's a state-changing request, try to fetch one first
      const method = options.method?.toUpperCase() || 'GET';
      const needsToken = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

      if (needsToken && !currentToken) {
        await refreshToken();
      }

      const finalToken = token || getCsrfTokenFromMeta();

      const headers = new Headers(options.headers);

      if (finalToken && needsToken) {
        headers.set('x-csrf-token', finalToken);
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [token, refreshToken]
  );

  // Initial token fetch
  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  return {
    token,
    isLoading,
    error,
    refreshToken,
    fetchWithCsrf,
  };
}

/**
 * Get CSRF token from meta tag
 */
function getCsrfTokenFromMeta(): string | null {
  if (typeof document === 'undefined') return null;

  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || null;
}

/**
 * Update CSRF token in meta tag
 */
function updateMetaTag(token: string): void {
  if (typeof document === 'undefined') return;

  let meta = document.querySelector('meta[name="csrf-token"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', token);
}

/**
 * Standalone function to get CSRF token
 * Useful outside of React components
 */
export function getCsrfToken(): string | null {
  return getCsrfTokenFromMeta();
}

/**
 * Standalone fetch with CSRF token
 */
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getCsrfTokenFromMeta();

  const headers = new Headers(options.headers);

  const method = options.method?.toUpperCase() || 'GET';
  if (token && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    headers.set('x-csrf-token', token);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
