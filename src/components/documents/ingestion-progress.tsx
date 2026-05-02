'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

type IngestionStage = 'parse' | 'chunk' | 'embed' | 'complete';
type IngestionState = 'idle' | 'processing' | 'completed' | 'failed';

interface IngestionProgressProps {
  documentId: string;
  workspaceId?: string;
  initialStatus?: 'pending' | 'processing' | 'ready' | 'error';
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface ProgressEvent {
  documentId: string;
  stage: IngestionStage;
  progress: number;
  message: string;
  timestamp: string;
}

// =============================================================================
// Stage Labels
// =============================================================================

const STAGE_LABELS: Record<IngestionStage, string> = {
  parse: 'Parsing document',
  chunk: 'Creating chunks',
  embed: 'Generating embeddings',
  complete: 'Complete',
};

// =============================================================================
// Component
// =============================================================================

export function IngestionProgress({
  documentId,
  workspaceId,
  initialStatus,
  onComplete,
  onError,
}: IngestionProgressProps) {
  const [state, setState] = useState<IngestionState>(() => {
    if (initialStatus === 'ready') return 'completed';
    if (initialStatus === 'error') return 'failed';
    if (initialStatus === 'processing' || initialStatus === 'pending') return 'processing';
    return 'idle';
  });
  const [progress, setProgress] = useState(() => {
    if (initialStatus === 'ready') return 100;
    return 0;
  });
  const [stage, setStage] = useState<IngestionStage>('parse');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Keep callback refs current without re-triggering the effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const handleProgressEvent = useCallback(
    (event: ProgressEvent) => {
      if (event.documentId !== documentId) return;

      setProgress(event.progress);
      setStage(event.stage);
      setMessage(event.message);
      setState('processing');
    },
    [documentId]
  );

  // Establish SSE connection for ingestion progress events
  useEffect(() => {
    // Don't connect if already completed or failed with no chance of retry
    if (state === 'completed') return;

    const params = new URLSearchParams({ documentId });
    if (workspaceId) {
      params.set('workspaceId', workspaceId);
    }

    const url = `/api/realtime/events?${params}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      // Connection established
    };

    // Listen for document_updated events which carry ingestion progress
    es.addEventListener('document_updated', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.documentId !== documentId) return;

        // Handle ingestion progress within document_updated events
        if (data.ingestionStage) {
          handleProgressEvent({
            documentId: data.documentId,
            stage: data.ingestionStage,
            progress: data.ingestionProgress ?? 0,
            message: data.ingestionMessage ?? '',
            timestamp: data.timestamp ?? new Date().toISOString(),
          });
        }

        // Handle document status changes
        if (data.status === 'completed' || data.status === 'ready') {
          setState('completed');
          setProgress(100);
          setStage('complete');
          setMessage('Document ready');
          onCompleteRef.current?.();
          // Close connection once completed
          es.close();
          eventSourceRef.current = null;
        }

        if (data.status === 'error') {
          setState('failed');
          setErrorMessage(data.errorMessage ?? 'Processing failed');
          onErrorRef.current?.(data.errorMessage ?? 'Processing failed');
          es.close();
          eventSourceRef.current = null;
        }
      } catch (_error: unknown) {}
    });

    // Listen for custom ingestion progress events (if server emits them directly)
    es.addEventListener('document_ingestion_progress', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ProgressEvent;
        handleProgressEvent(data);
      } catch (_error: unknown) {}
    });

    es.addEventListener('document_ingestion_completed', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.documentId === documentId) {
          setState('completed');
          setProgress(100);
          setStage('complete');
          setMessage('Document ready');
          onCompleteRef.current?.();
          es.close();
          eventSourceRef.current = null;
        }
      } catch (_error: unknown) {}
    });

    es.addEventListener('document_ingestion_failed', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.documentId === documentId) {
          setState('failed');
          setErrorMessage(data.error ?? 'Processing failed');
          onErrorRef.current?.(data.error ?? 'Processing failed');
          es.close();
          eventSourceRef.current = null;
        }
      } catch (_error: unknown) {}
    });

    es.onerror = () => {
      // SSE connection error; the browser will auto-reconnect for EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [documentId, workspaceId, state, handleProgressEvent]);

  // Don't render anything if idle or already completed/failed and the parent hides it
  if (state === 'idle') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="mt-2 space-y-1.5">
          {/* Completed state */}
          {state === 'completed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-medium">Ready</span>
            </motion.div>
          )}

          {/* Failed state */}
          {state === 'failed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="font-medium">Failed</span>
              </div>
              {errorMessage && (
                <p className="text-xs text-destructive/80 line-clamp-2">{errorMessage}</p>
              )}
            </motion.div>
          )}

          {/* Processing state */}
          {state === 'processing' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{STAGE_LABELS[stage]}</span>
                </div>
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    progress >= 90
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress
                value={progress}
                className={cn(
                  'h-1.5 transition-all',
                  progress >= 90 && '[&>[data-slot=indicator]]:bg-emerald-500'
                )}
              />
              {message && (
                <p className="text-[11px] text-muted-foreground/70 truncate">{message}</p>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
