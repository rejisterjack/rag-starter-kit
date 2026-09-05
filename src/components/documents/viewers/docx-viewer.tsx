'use client';

import DOMPurify from 'dompurify';
import { FileText, Loader2 } from 'lucide-react';
import mammoth from 'mammoth';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TextViewer } from './text-viewer';

interface DocxViewerProps {
  url: string;
  content?: string;
  fileName: string;
  className?: string;
}

export function DocxViewer({ url, content, fileName, className }: DocxViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function convert() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Fetch failed');
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) {
          const sanitized = DOMPurify.sanitize(result.value);
          setHtml(sanitized);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    convert();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading document...</p>
      </div>
    );
  }

  if (error || !html) {
    // Fallback: show extracted text content
    if (content) {
      return <TextViewer content={content} className={className} />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-8">
        <div className="p-4 bg-muted/20 border border-white/5 rounded-2xl">
          <FileText className="h-10 w-10 text-muted-foreground/75" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-foreground text-sm">Could not render document</p>
          <p className="text-xs text-muted-foreground/60">
            This file content could not be displayed directly.
          </p>
        </div>
        <a
          href={url}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-transform hover:scale-105 active:scale-95"
        >
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg"
          >
            Download file
          </Button>
        </a>
      </div>
    );
  }

  return (
    <ScrollArea className={className ?? 'h-full'}>
      <div className="min-h-full py-8 px-4 flex justify-center bg-transparent">
        <div className="w-full max-w-3xl bg-neutral-950/70 border border-white/10 shadow-2xl rounded-2xl p-8 md:p-12 backdrop-blur-sm prose prose-sm dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-headings:font-semibold">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </ScrollArea>
  );
}
