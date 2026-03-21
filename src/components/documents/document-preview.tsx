'use client';

import { ChevronLeft, ChevronRight, Highlighter, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Document } from './document-card';

interface DocumentChunk {
  id: string;
  text: string;
  index: number;
  isHighlighted?: boolean;
}

interface DocumentPreviewProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  chunks?: DocumentChunk[];
  highlightedChunkId?: string;
  onChunkClick?: (chunk: DocumentChunk) => void;
}

export function DocumentPreview({
  document,
  isOpen,
  onClose,
  chunks,
  highlightedChunkId,
  onChunkClick,
}: DocumentPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                {document.name}
              </DialogTitle>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{(document.size / 1024).toFixed(1)} KB</span>
                <span>·</span>
                <span>{document.type}</span>
                {chunks && (
                  <>
                    <span>·</span>
                    <span>{chunks.length} chunks</span>
                  </>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden border-t">
          {chunks ? (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                {chunks.map((chunk) => (
                  // biome-ignore lint/a11y/noStaticElementInteractions: Interactive element with conditional role, tabIndex, and keyboard handler
                  // biome-ignore lint/a11y/useAriaPropsSupportedByRole: Conditional ARIA props based on interactive state
                  <div
                    key={chunk.id}
                    onClick={() => onChunkClick?.(chunk)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onChunkClick?.(chunk);
                      }
                    }}
                    role={onChunkClick ? 'button' : undefined}
                    tabIndex={onChunkClick ? 0 : undefined}
                    aria-label={onChunkClick ? `View chunk ${chunk.index + 1}` : undefined}
                    className={cn(
                      'relative rounded-lg border p-4 transition-all',
                      'hover:border-primary/50',
                      onChunkClick && 'cursor-pointer',
                      chunk.isHighlighted && 'border-primary bg-primary/5',
                      highlightedChunkId === chunk.id && 'ring-2 ring-primary ring-offset-2'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="shrink-0">
                        Chunk {chunk.index + 1}
                      </Badge>
                      <p className="text-sm leading-relaxed text-foreground">{chunk.text}</p>
                    </div>
                    {chunk.isHighlighted && (
                      <div className="absolute right-2 top-2">
                        <Highlighter className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p>Document preview not available</p>
            </div>
          )}
        </div>

        {/* Footer with pagination if needed */}
        {chunks && chunks.length > 0 && (
          <div className="border-t p-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Alternative inline preview component
interface InlineDocumentPreviewProps {
  document: Document;
  chunks?: DocumentChunk[];
  highlightedChunkId?: string;
  onClose?: () => void;
  className?: string;
}

export function InlineDocumentPreview({
  document,
  chunks,
  highlightedChunkId,
  onClose,
  className,
}: InlineDocumentPreviewProps) {
  return (
    <div className={cn('flex flex-col h-full bg-background border-l', className)}>
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold truncate max-w-[250px]">{document.name}</h3>
          <p className="text-xs text-muted-foreground">{chunks?.length || 0} chunks</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {chunks?.map((chunk) => (
            <div
              key={chunk.id}
              className={cn(
                'rounded-lg border p-3 text-sm transition-all',
                highlightedChunkId === chunk.id && 'border-primary bg-primary/5 ring-1 ring-primary'
              )}
            >
              <Badge variant="outline" className="mb-2">
                Chunk {chunk.index + 1}
              </Badge>
              <p className="text-muted-foreground">{chunk.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
