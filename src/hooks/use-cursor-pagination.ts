/**
 * Cursor-Based Pagination Hook — backed by TanStack Query useInfiniteQuery
 */

'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { CursorPaginationParams, CursorPaginationResult } from '@/lib/db/cursor-pagination';

interface UseCursorPaginationOptions<T> {
  queryKey: readonly unknown[];
  fetchPage: (params: CursorPaginationParams) => Promise<CursorPaginationResult<T>>;
  initialLimit?: number;
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
  isFetchingNextPage: boolean;
}

export function useCursorPagination<T extends { id: string }>(
  options: UseCursorPaginationOptions<T>
): UseCursorPaginationReturn<T> {
  const { queryKey, fetchPage, initialLimit = 20 } = options;

  type PageParam = { cursor: string | null; direction: 'forward' | 'backward' };

  const initialPageParam: PageParam = { cursor: null, direction: 'forward' };

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }: { pageParam: PageParam }) =>
      fetchPage({
        limit: initialLimit,
        cursor: pageParam.cursor,
        direction: pageParam.direction,
      }),
    initialPageParam,
    getNextPageParam: (lastPage): PageParam | undefined => {
      if (!lastPage.pagination.hasNextPage) return undefined;
      return { cursor: lastPage.pagination.nextCursor, direction: 'forward' };
    },
    getPreviousPageParam: (firstPage): PageParam | undefined => {
      if (!firstPage.pagination.hasPreviousPage) return undefined;
      return { cursor: firstPage.pagination.previousCursor, direction: 'backward' };
    },
  });

  const items = useMemo(() => {
    if (!query.data?.pages) return [];
    return query.data.pages.flatMap((page) => page.items);
  }, [query.data?.pages]);

  const firstPage = query.data?.pages[0];
  const lastPage = query.data?.pages[query.data.pages.length - 1];

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: lastPage?.pagination.hasNextPage ?? false,
    hasPreviousPage: firstPage?.pagination.hasPreviousPage ?? false,
    loadNextPage: async () => {
      await query.fetchNextPage();
    },
    loadPreviousPage: async () => {
      await query.fetchPreviousPage();
    },
    refresh: async () => {
      await query.refetch();
    },
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
