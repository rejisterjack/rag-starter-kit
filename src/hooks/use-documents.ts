/**
 * Document CRUD hooks — backed by TanStack Query
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Document } from '@/components/documents/document-card';
import { ApiError, apiClient } from '@/lib/api-client';
import { documentKeys } from '@/lib/query-keys';

interface ApiDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  chunkCount?: number;
  createdAt: string;
  errorMessage?: string;
}

interface DocumentListResponse {
  success: boolean;
  data: { documents: ApiDocument[] };
}

interface DocumentDetailResponse {
  success: boolean;
  data: { chunks: Array<{ id: string; index: number; text: string }> };
}

interface IngestResponse {
  success: boolean;
  data: { document: { id: string; name: string } };
}

function formatDocument(doc: ApiDocument): Document {
  return { ...doc, createdAt: new Date(doc.createdAt) };
}

export function useDocuments() {
  const query = useQuery({
    queryKey: documentKeys.lists(),
    queryFn: async (): Promise<Document[]> => {
      const data = await apiClient<DocumentListResponse>('/api/documents');
      if (!data.success) throw new Error('Failed to fetch documents');
      return data.data.documents.map(formatDocument);
    },
    // Auto-poll every 3s while any doc is processing/pending
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs?.some((d) => d.status === 'processing' || d.status === 'pending')) {
        return 3000;
      }
      return false;
    },
  });

  return query;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: File[]) => {
      const results: Array<{ file: string; success: boolean }> = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const data = await apiClient<IngestResponse>('/api/ingest', {
            method: 'POST',
            body: formData,
          });
          if (data.success) {
            results.push({ file: file.name, success: true });
            toast.success(`Uploading ${file.name}...`);
          }
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : 'Unknown error';
          toast.error(`Failed to upload ${file.name}: ${msg}`);
          results.push({ file: file.name, success: false });
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useUploadUrl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (url: string) => {
      const formData = new FormData();
      formData.append('url', url);
      const data = await apiClient<IngestResponse>('/api/ingest', {
        method: 'POST',
        body: formData,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      toast.success('URL queued for processing');
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to ingest URL');
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient(`/api/documents?id=${id}`, { method: 'DELETE' });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      const previous = queryClient.getQueryData<Document[]>(documentKeys.lists());
      queryClient.setQueryData<Document[]>(documentKeys.lists(), (old) =>
        old?.filter((doc) => doc.id !== id)
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success('Document deleted');
    },
    onError: (_err: Error, _id: string, context?: { previous?: Document[] }) => {
      if (context?.previous) {
        queryClient.setQueryData(documentKeys.lists(), context.previous);
      }
      toast.error('Failed to delete document');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useReingestDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient('/api/ingest/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
      });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      const previous = queryClient.getQueryData<Document[]>(documentKeys.lists());
      queryClient.setQueryData<Document[]>(documentKeys.lists(), (old) =>
        old?.map((doc) =>
          doc.id === id ? { ...doc, status: 'processing' as const, progress: 0 } : doc
        )
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success('Re-ingestion started');
    },
    onError: (_err: Error, _id: string, context?: { previous?: Document[] }) => {
      if (context?.previous) {
        queryClient.setQueryData(documentKeys.lists(), context.previous);
      }
      toast.error('Failed to re-ingest document');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useDocumentPreview(documentId: string | null) {
  return useQuery({
    queryKey: documentKeys.detail(documentId || ''),
    queryFn: async () => {
      const data = await apiClient<DocumentDetailResponse>(`/api/documents/${documentId}`);
      return data.data.chunks || [];
    },
    enabled: !!documentId,
  });
}
