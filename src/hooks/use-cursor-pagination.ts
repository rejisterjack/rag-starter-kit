'use client';

import { useCallback, useState } from 'react';
import type { CursorPaginationParams, CursorPaginationResult } from '@/lib/db/cursor-pagination';

interface UseCursorPaginationOptions<T> {
  fetchPage: (params: CursorPaginationParams) => Promise<CursorPaginationResult<T>>;
  initialLimit?: number;
  initialData?: T[];
}

interface UseCursorPaginationReturn<T> {
  items: T[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  loadNextPage: () => Promise<void>;
  loadPreviousPage: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCursorPagination<T extends { id: string }>(
  options: UseCursorPaginationOptions<T>
): UseCursorPaginationReturn<T> {
  const { fetchPage, initialLimit = 20 } = options;

  const [items, setItems] = useState<T[]>(options.initialData || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState({
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null as string | null,
    previousCursor: null as string | null,
  });

  const loadNextPage = useCallback(async () => {
    if (isLoading || !pagination.hasNextPage) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchPage({
        limit: initialLimit,
        cursor: pagination.nextCursor,
        direction: 'forward',
      });

      setItems((prev) => [...prev, ...result.items]);
      setPagination({
        hasNextPage: result.pagination.hasNextPage,
        hasPreviousPage: true,
        nextCursor: result.pagination.nextCursor,
        previousCursor: result.pagination.previousCursor,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load page'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, initialLimit, isLoading, pagination.hasNextPage, pagination.nextCursor]);

  const loadPreviousPage = useCallback(async () => {
    if (isLoading || !pagination.hasPreviousPage) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchPage({
        limit: initialLimit,
        cursor: pagination.previousCursor,
        direction: 'backward',
      });

      setItems((prev) => [...result.items, ...prev]);
      setPagination({
        hasNextPage: true,
        hasPreviousPage: result.pagination.hasPreviousPage,
        nextCursor: result.pagination.nextCursor,
        previousCursor: result.pagination.previousCursor,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load page'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, initialLimit, isLoading, pagination.hasPreviousPage, pagination.previousCursor]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchPage({
        limit: initialLimit,
        direction: 'forward',
      });

      setItems(result.items);
      setPagination({
        hasNextPage: result.pagination.hasNextPage,
        hasPreviousPage: false,
        nextCursor: result.pagination.nextCursor,
        previousCursor: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, initialLimit]);

  return {
    items,
    isLoading,
    error,
    hasNextPage: pagination.hasNextPage,
    hasPreviousPage: pagination.hasPreviousPage,
    loadNextPage,
    loadPreviousPage,
    refresh,
  };
}
