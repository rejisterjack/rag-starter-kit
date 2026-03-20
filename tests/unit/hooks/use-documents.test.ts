import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocuments } from '@/hooks/use-documents';

// Mock fetch
global.fetch = vi.fn();

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

  it('fetches documents successfully', async () => {
    const mockDocuments = [
      { id: '1', name: 'doc1.pdf', status: 'processed' },
      { id: '2', name: 'doc2.pdf', status: 'processed' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    } as Response);

    const { result } = renderHook(() => useDocuments('ws-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.documents).toEqual(mockDocuments);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDocuments('ws-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('uploads document successfully', async () => {
    const mockDocument = { id: '1', name: 'uploaded.pdf', status: 'processing' };

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response) // Initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: [mockDocument] }),
      } as Response); // Upload response

    const { result } = renderHook(() => useDocuments('ws-1'), {
      wrapper: createWrapper(),
    });

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.uploadDocument(file);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ingest'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('deletes document successfully', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const { result } = renderHook(() => useDocuments('ws-1'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deleteDocument('doc-1');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/documents/doc-1'),
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('filters documents by search query', async () => {
    const mockDocuments = [
      { id: '1', name: 'financial-report.pdf' },
      { id: '2', name: 'meeting-notes.pdf' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    } as Response);

    const { result } = renderHook(() => useDocuments('ws-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.documents).toEqual(mockDocuments);
    });

    act(() => {
      result.current.setSearchQuery('financial');
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].name).toContain('financial');
  });

  it('sorts documents by date', async () => {
    const mockDocuments = [
      { id: '1', name: 'old.pdf', createdAt: '2023-01-01' },
      { id: '2', name: 'new.pdf', createdAt: '2024-01-01' },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    } as Response);

    const { result } = renderHook(() => useDocuments('ws-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.documents).toEqual(mockDocuments);
    });

    act(() => {
      result.current.setSortBy('date-desc');
    });

    expect(result.current.sortedDocuments[0].name).toBe('new.pdf');
  });
});
