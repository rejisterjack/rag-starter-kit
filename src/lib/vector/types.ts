/**
 * Shared types for the pgvector store.
 * Search results keep a Qdrant-like { id, score, payload } shape so retrieval
 * mappers do not need a second translation layer.
 */

import type { RetrievalFilters } from '@/lib/rag/retrieval/types';

export interface ChunkPointData {
  id?: string;
  documentId: string;
  content: string;
  embedding: number[];
  index: number;
  start?: number | null;
  end?: number | null;
  page?: number | null;
  section?: string | null;
}

export interface UpsertOptions {
  userId: string;
  workspaceId?: string;
  documentName: string;
  documentType: string;
  batchSize?: number;
  onProgress?: (completed: number, total: number) => void;
}

export interface VectorFilter {
  userId?: string;
  workspaceId?: string;
  documentIds?: string[];
  documentTypes?: string[];
  dateRange?: { from: Date; to: Date };
  filters?: RetrievalFilters;
}

export interface SearchOptions {
  filter?: VectorFilter;
  topK?: number;
  minScore?: number;
  withPayload?: boolean;
}

export interface ScoredPoint {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface DocumentChunk {
  id: string;
  text: string;
  index: number;
  page?: number | null;
  section?: string | null;
}

export interface ChunkRow {
  id: string;
  content: string;
  index: number;
  page: number | null;
  section: string | null;
  documentId: string;
  documentName: string;
  documentType: string;
  start: number;
  end: number;
  userId: string;
  workspaceId: string | null;
}
