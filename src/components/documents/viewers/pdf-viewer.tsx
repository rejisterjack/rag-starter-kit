'use client';

import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { ChevronLeft, ChevronRight, FileText, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfViewerProps {
  url: string;
  fileName: string;
}

export function PdfViewer({ url, fileName }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [containerWidth, setContainerWidth] = useState(600);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  }, []);

  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width - 32);
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    }
    return undefined;
  }, []);

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-40 transition-transform active:scale-95"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums min-w-[80px] text-center text-muted-foreground font-medium">
            {pageNumber} <span className="text-muted-foreground/40 mx-0.5">/</span> {numPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-40 transition-transform active:scale-95"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-40 transition-transform active:scale-95"
            disabled={scale <= 0.5}
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums min-w-[50px] text-center text-muted-foreground font-medium">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-40 transition-transform active:scale-95"
            disabled={scale >= 3}
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={measuredRef} className="flex-1 overflow-auto bg-transparent">
        <div className="flex justify-center py-8 px-4">
          <PdfDocument
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <FileText className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-400">Failed to load PDF</p>
                <a
                  href={url}
                  download={fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline text-sm"
                >
                  Download file instead
                </a>
              </div>
            }
          >
            <div className="shadow-2xl border border-white/10 rounded-2xl overflow-hidden bg-neutral-900/50 backdrop-blur-sm transition-all duration-300">
              <PdfPage
                pageNumber={pageNumber}
                scale={scale}
                width={containerWidth > 0 ? containerWidth * scale : undefined}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          </PdfDocument>
        </div>
      </div>
    </div>
  );
}
