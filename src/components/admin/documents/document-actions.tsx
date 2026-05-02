'use client';

import { RefreshCw, Trash2 } from 'lucide-react';

// =============================================================================
// Delete Button with confirmation
// =============================================================================

export function DeleteButton({ documentId }: { documentId: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
      title="Delete document"
      onClick={() => {
        if (
          window.confirm(
            'Are you sure you want to delete this document? This action cannot be undone.'
          )
        ) {
          fetch(`/api/ingest?id=${documentId}`, { method: 'DELETE' })
            .then((res) => {
              if (res.ok) {
                window.location.reload();
              }
            })
            .catch(() => {
              alert('Failed to delete document.');
            });
        }
      }}
    >
      <Trash2 className="h-3 w-3" />
      Delete
    </button>
  );
}

// =============================================================================
// Re-ingest Button for failed documents
// =============================================================================

export function ReingestButton({ documentId }: { documentId: string }) {
  const handleReingest = async () => {
    try {
      const res = await fetch(`/api/ingest?id=${documentId}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        // Trigger retry via the ingestion retry event
        const userId = data?.data?.userId;
        if (userId) {
          await fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              action: 'retry',
            }),
          });
        }
        window.location.reload();
      }
    } catch (_error: unknown) {
      alert('Failed to re-ingest document.');
    }
  };

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
      title="Re-ingest document"
      onClick={handleReingest}
    >
      <RefreshCw className="h-3 w-3" />
      Re-ingest
    </button>
  );
}
