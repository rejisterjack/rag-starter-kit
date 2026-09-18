import type { RetrievalFilters, RetrievalOptions } from '@/lib/rag/retrieval/types';
import type { VectorFilter } from './types';

export function buildVectorFilter(options: {
  userId?: string;
  workspaceId?: string;
  filters?: RetrievalFilters;
}): VectorFilter | undefined {
  const hasIdentity = Boolean(options.userId || options.workspaceId);
  const hasNested = Boolean(
    options.filters &&
    (options.filters.documentIds?.length ||
      options.filters.documentTypes?.length ||
      options.filters.dateRange ||
      options.filters.userId)
  );

  if (!hasIdentity && !hasNested) return undefined;

  return {
    userId: options.userId,
    workspaceId: options.workspaceId,
    filters: options.filters,
  };
}

export function buildVectorFilterFromRetrievalOptions(
  options: RetrievalOptions
): VectorFilter | undefined {
  return buildVectorFilter({
    userId: options.userId,
    workspaceId: options.workspaceId,
    filters: options.filters,
  });
}

/** @deprecated Use buildVectorFilter */
export const buildQdrantFilter = buildVectorFilter;
/** @deprecated Use buildVectorFilterFromRetrievalOptions */
export const buildQdrantFilterFromRetrievalOptions = buildVectorFilterFromRetrievalOptions;
