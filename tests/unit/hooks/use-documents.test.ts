import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useDeleteDocument,
  useDocumentPreview,
  useDocuments,
  useUploadDocument,
  useUploadUrl,
} from '@/hooks/use-documents';

// Mock apiClient
vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  apiClient: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock query-keys
vi.mock('@/lib/query-keys', () => ({
  documentKeys: {
    all: ['documents'] as const,
    lists: () => ['documents', 'list'] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
  },
}));

import { apiClient } from '@/lib/api-client';

describe('useDocuments', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDocuments', () => {
    it('fetches documents successfully', async () => {
      const mockDocuments = [
        {
          id: '1',
          name: 'doc1.pdf',
          type: 'pdf',
          size: 1024,
          status: 'completed',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          name: 'doc2.pdf',
          type: 'pdf',
          size: 2048,
          status: 'completed',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      vi.mocked(apiClient).mockResolvedValueOnce({
        success: true,
        data: { documents: mockDocuments },
      });

      const { result } = renderHook(() => useDocuments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe('doc1.pdf');
      expect(result.current.data?.[0].createdAt).toBeInstanceOf(Date);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch error', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce({
        success: false,
        data: { documents: [] },
      });

      const { result } = renderHook(() => useDocuments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useUploadDocument', () => {
    it('uploads documents successfully', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce({
        success: true,
        data: { document: { id: '1', name: 'uploaded.pdf' } },
      });

      const { result } = renderHook(() => useUploadDocument(), {
        wrapper: createWrapper(),
      });

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      let uploadResult: Array<{ file: string; success: boolean }> | undefined;
      await act(async () => {
        uploadResult = await result.current.mutateAsync([file]);
      });

      expect(apiClient).toHaveBeenCalledWith(
        '/api/ingest',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(uploadResult).toBeDefined();
    });
  });

  describe('useDeleteDocument', () => {
    it('deletes document successfully', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteDocument(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('doc-1');
      });

      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('/api/documents?id=doc-1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('useUploadUrl', () => {
    it('uploads URL successfully', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce({
        success: true,
        data: { document: { id: '1', name: 'https://example.com/doc.pdf' } },
      });

      const { result } = renderHook(() => useUploadUrl(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('https://example.com/doc.pdf');
      });

      expect(apiClient).toHaveBeenCalledWith(
        '/api/ingest',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
  });

  describe('useDocumentPreview', () => {
    it('fetches document preview when documentId is provided', async () => {
      const mockChunks = [
        { id: 'chunk-1', index: 0, text: 'First chunk content' },
        { id: 'chunk-2', index: 1, text: 'Second chunk content' },
      ];

      vi.mocked(apiClient).mockResolvedValueOnce({
        success: true,
        data: { chunks: mockChunks },
      });

      const { result } = renderHook(() => useDocumentPreview('doc-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].text).toBe('First chunk content');
    });

    it('does not fetch when documentId is null', () => {
      const { result } = renderHook(() => useDocumentPreview(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(apiClient).not.toHaveBeenCalled();
    });
  });
});
