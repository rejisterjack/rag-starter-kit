/**
 * Cursor-Based Pagination
 * 
 * Implements cursor-based pagination for efficient data fetching
 * with better performance than offset-based pagination for large datasets.
 * 
 * Benefits:
 * - O(1) performance regardless of page depth
 * - Stable results during concurrent writes
 * - No skipped/duplicated items
 * - Ideal for infinite scroll patterns
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface CursorPaginationParams {
  /** Number of items per page */
  limit: number;
  /** Cursor to start from (for next/prev pages) */
  cursor?: string | null;
  /** Sort direction */
  direction?: 'forward' | 'backward';
  /** Sort field */
  sortField?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginationResult<T> {
  items: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
    totalCount?: number;
  };
}

export interface EncodedCursor {
  id: string;
  value: unknown;
  direction: 'forward' | 'backward';
}

// =============================================================================
// Cursor Encoding/Decoding
// =============================================================================

/**
 * Encode cursor for client storage
 * Uses base64url encoding for URL safety
 */
export function encodeCursor(data: EncodedCursor): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64url');
}

/**
 * Decode cursor from client
 */
export function decodeCursor(cursor: string): EncodedCursor | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(json) as EncodedCursor;
  } catch (error) {
    logger.warn('Failed to decode cursor', { cursor, error });
    return null;
  }
}

/**
 * Validate cursor structure
 */
export const cursorSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.number(), z.date()]),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

// =============================================================================
// Query Builders
// =============================================================================

interface CursorQueryOptions {
  cursorField: string;
  cursorValue: unknown;
  direction: 'forward' | 'backward';
  sortOrder: 'asc' | 'desc';
}

/**
 * Build where clause for cursor pagination
 * Handles both forward and backward pagination with proper comparison
 */
export function buildCursorWhereClause(options: CursorQueryOptions): Record<string, unknown> {
  const { cursorField, cursorValue, direction, sortOrder } = options;

  // For forward pagination with asc: value > cursor
  // For forward pagination with desc: value < cursor
  // For backward pagination with asc: value < cursor
  // For backward pagination with desc: value > cursor
  const isForward = direction === 'forward';
  const isAsc = sortOrder === 'asc';
  const useGreaterThan = isForward === isAsc;

  return {
    [cursorField]: useGreaterThan 
      ? { gt: cursorValue }
      : { lt: cursorValue },
  };
}

/**
 * Build complete cursor pagination query for Prisma
 */
export function buildCursorQuery<T extends Record<string, unknown>>(
  params: CursorPaginationParams,
  options: {
    /** Field to use for cursor (e.g., 'createdAt', 'id') */
    cursorField: keyof T;
    /** Secondary sort field for stable ordering */
    idField?: keyof T;
  }
) {
  const { limit, cursor, direction = 'forward', sortOrder = 'desc' } = params;
  const { cursorField, idField = 'id' as keyof T } = options;

  const pageSize = Math.min(Math.max(1, limit), 100); // Max 100 items per page
  const take = direction === 'backward' ? -pageSize : pageSize;

  let where: Record<string, unknown> = {};
  let orderBy: Array<Record<string, string>> = [];

  // Build order by
  orderBy.push({ [cursorField as string]: sortOrder });
  if (idField !== cursorField) {
    // Add secondary sort by ID for stable ordering
    orderBy.push({ [idField as string]: sortOrder });
  }

  // Build where clause from cursor
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      where = buildCursorWhereClause({
        cursorField: cursorField as string,
        cursorValue: decoded.value,
        direction,
        sortOrder,
      });
    }
  }

  return {
    take,
    where,
    orderBy,
    // Include one extra item to check if there's a next page
    takeCount: Math.abs(take) + 1,
  };
}

// =============================================================================
// Pagination Result Builder
// =============================================================================

/**
 * Build pagination result from query results
 */
export function buildPaginationResult<T extends { id: string }>(
  items: T[],
  params: CursorPaginationParams,
  options: {
    cursorField: keyof T;
    totalCount?: number;
  }
): CursorPaginationResult<T> {
  const { limit, direction = 'forward' } = params;
  const { cursorField, totalCount } = options;
  const pageSize = Math.min(Math.max(1, limit), 100);

  // Check if we have more items
  const hasExtra = items.length > pageSize;
  const resultItems = hasExtra ? items.slice(0, pageSize) : items;

  // If paginating backward, we got items in reverse order - flip them
  const orderedItems = direction === 'backward' ? [...resultItems].reverse() : resultItems;

  // Generate cursors
  const firstItem = orderedItems[0];
  const lastItem = orderedItems[orderedItems.length - 1];

  const nextCursor = hasExtra && lastItem
    ? encodeCursor({
        id: lastItem.id,
        value: lastItem[cursorField],
        direction: 'forward',
      })
    : null;

  const previousCursor = firstItem
    ? encodeCursor({
        id: firstItem.id,
        value: firstItem[cursorField],
        direction: 'backward',
      })
    : null;

  // Determine hasNextPage/hasPreviousPage based on direction and results
  const hasNextPage = direction === 'forward' ? hasExtra : params.cursor !== undefined;
  const hasPreviousPage = direction === 'backward' ? hasExtra : params.cursor !== undefined;

  return {
    items: orderedItems,
    pagination: {
      hasNextPage,
      hasPreviousPage,
      nextCursor,
      previousCursor,
      totalCount,
    },
  };
}

// =============================================================================
// Pagination Helpers
// =============================================================================

/**
 * Create pagination response headers
 */
export function createPaginationHeaders(
  result: CursorPaginationResult<unknown>
): Record<string, string> {
  return {
    'X-Has-Next-Page': String(result.pagination.hasNextPage),
    'X-Has-Previous-Page': String(result.pagination.hasPreviousPage),
    ...(result.pagination.totalCount !== undefined && {
      'X-Total-Count': String(result.pagination.totalCount),
    }),
  };
}

/**
 * Parse pagination params from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults?: Partial<CursorPaginationParams>
): CursorPaginationParams {
  const limit = parseInt(searchParams.get('limit') || '', 10);
  const cursor = searchParams.get('cursor');
  const direction = searchParams.get('direction') as 'forward' | 'backward' | null;
  const sortField = searchParams.get('sortField');
  const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

  return {
    limit: Number.isNaN(limit) ? (defaults?.limit ?? 20) : limit,
    cursor: cursor || defaults?.cursor || undefined,
    direction: direction || defaults?.direction || 'forward',
    sortField: sortField || defaults?.sortField || 'createdAt',
    sortOrder: sortOrder || defaults?.sortOrder || 'desc',
  };
}

/**
 * Validate pagination params
 */
export function validatePaginationParams(
  params: CursorPaginationParams
): { valid: true } | { valid: false; error: string } {
  if (params.limit < 1 || params.limit > 100) {
    return { valid: false, error: 'Limit must be between 1 and 100' };
  }

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (!decoded) {
      return { valid: false, error: 'Invalid cursor format' };
    }
  }

  return { valid: true };
}

// =============================================================================
// React Hook
// =============================================================================

import { useCallback, useState } from 'react';

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

      setItems(prev => [...prev, ...result.items]);
      setPagination({
        hasNextPage: result.pagination.hasNextPage,
        hasPreviousPage: true, // We have previous now
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

      setItems(prev => [...result.items, ...prev]);
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
