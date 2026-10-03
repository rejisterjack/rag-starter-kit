'use client';

import { Download, FileText, Loader2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Document } from './document-card';
import {
  isImage as checkImage,
  isPdf as checkPdf,
  isDocx,
  isHtml,
  isMarkdown,
  isPresentation,
  isSpreadsheet,
  isText,
} from './viewers/document-types';

const PdfViewer = dynamic(() => import('./viewers/pdf-viewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <ViewerLoader />,
});
const ImageViewer = dynamic(() => import('./viewers/image-viewer').then((m) => m.ImageViewer), {
  ssr: false,
  loading: () => <ViewerLoader />,
});
const MarkdownViewer = dynamic(
  () => import('./viewers/markdown-viewer').then((m) => m.MarkdownViewer),
  { ssr: false, loading: () => <ViewerLoader /> }
);
const TextViewer = dynamic(() => import('./viewers/text-viewer').then((m) => m.TextViewer), {
  ssr: false,
  loading: () => <ViewerLoader />,
});
const DocxViewer = dynamic(() => import('./viewers/docx-viewer').then((m) => m.DocxViewer), {
  ssr: false,
  loading: () => <ViewerLoader />,
});
const HtmlViewer = dynamic(() => import('./viewers/html-viewer').then((m) => m.HtmlViewer), {
  ssr: false,
  loading: () => <ViewerLoader />,
});
const SpreadsheetViewer = dynamic(
  () => import('./viewers/spreadsheet-viewer').then((m) => m.SpreadsheetViewer),
  { ssr: false, loading: () => <ViewerLoader /> }
);
const PresentationViewer = dynamic(
  () => import('./viewers/presentation-viewer').then((m) => m.PresentationViewer),
  { ssr: false, loading: () => <ViewerLoader /> }
);
const FallbackViewer = dynamic(
  () => import('./viewers/fallback-viewer').then((m) => m.FallbackViewer),
  { ssr: false, loading: () => <ViewerLoader /> }
);

function ViewerLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Loading viewer...</p>
    </div>
  );
}

function dispatchViewer(doc: Document, content?: string) {
  // Use the local proxy endpoint to stream the file securely and avoid CORS/CSP/SW fetch blocks.
  const url = doc.storageUrl ? `/api/documents/${doc.id}/file` : undefined;

  if (checkPdf(doc) && url) return <PdfViewer url={url} fileName={doc.name} />;
  if (checkImage(doc) && url) return <ImageViewer url={url} fileName={doc.name} />;
  if (isMarkdown(doc) && content) return <MarkdownViewer content={content} />;
  if (isDocx(doc) && url) return <DocxViewer url={url} content={content} fileName={doc.name} />;
  if (isHtml(doc) && content) return <HtmlViewer content={content} />;
  if (isSpreadsheet(doc) && content) return <SpreadsheetViewer content={content} />;
  if (isPresentation(doc) && content) return <PresentationViewer content={content} />;
  if (isText(doc) && content) return <TextViewer content={content} />;
  return <FallbackViewer content={content} url={url} fileName={doc.name} />;
}

// =============================================================================
// Main Document Preview Dialog
// =============================================================================

interface DocumentPreviewProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  content?: string;
  chunks?: Array<{ id: string; text: string; index: number; isHighlighted?: boolean }>;
  highlightedChunkId?: string;
  onChunkClick?: (chunk: { id: string; text: string; index: number }) => void;
}

export function DocumentPreview({ document, isOpen, onClose, content }: DocumentPreviewProps) {
  if (!document) return null;

  const isProcessing = document.status === 'processing' || document.status === 'pending';
  const url = document.storageUrl ? `/api/documents/${document.id}/file` : undefined;

  const renderContent = () => {
    if (isProcessing) {
      return (
        <div className="flex flex-col h-full items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Document is being processed...</p>
          <p className="text-xs text-muted-foreground/60">
            Preview will appear once processing completes
          </p>
        </div>
      );
    }

    if (document.status === 'error') {
      return (
        <div className="flex flex-col h-full items-center justify-center gap-3 text-muted-foreground">
          <FileText className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-400">Processing failed</p>
          <p className="text-xs text-muted-foreground/60">This document could not be processed</p>
        </div>
      );
    }

    if (!url && !content) {
      return (
        <div className="flex flex-col h-full items-center justify-center gap-3 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p className="text-sm">No file available for preview</p>
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">
        {dispatchViewer(document, content)}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 border border-white/10 glass-heavy shadow-2xl rounded-2xl overflow-hidden [&>button]:hidden">
        <DialogHeader className="p-5 pb-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              {document.name}
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {url && (
                <a
                  href={url}
                  download={document.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-transform hover:scale-105 active:scale-95"
                >
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg transition-transform hover:scale-105 active:scale-95"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>{(document.size / 1024).toFixed(1)} KB</span>
            <span>·</span>
            <span>{document.type}</span>
            {isProcessing && (
              <>
                <span>·</span>
                <span className="text-amber-400">Processing...</span>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Inline Document Preview (sidebar variant)
// =============================================================================

interface InlineDocumentPreviewProps {
  document: Document;
  content?: string;
  chunks?: Array<{ id: string; text: string; index: number }>;
  highlightedChunkId?: string;
  onClose?: () => void;
  className?: string;
}

export function InlineDocumentPreview({
  document,
  content,
  onClose,
  className,
}: InlineDocumentPreviewProps) {
  return (
    <div className={`flex flex-col h-full bg-background border-l ${className ?? ''}`}>
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold truncate max-w-[250px]">{document.name}</h3>
          <p className="text-xs text-muted-foreground">{(document.size / 1024).toFixed(1)} KB</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">{dispatchViewer(document, content)}</div>
    </div>
  );
}
