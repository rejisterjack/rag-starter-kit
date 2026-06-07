'use client';

import DOMPurify from 'dompurify';
import { FileText, Loader2 } from 'lucide-react';
import mammoth from 'mammoth';
import { useEffect, useState } from 'react';
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
        <Loader2 className="h-8 w-8 animate-spin" />
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
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <FileText className="h-8 w-8" />
        <p className="text-sm">Could not render document</p>
        <a
          href={url}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline text-sm"
        >
          Download file
        </a>
      </div>
    );
  }

  return (
    <ScrollArea className={className ?? 'h-full'}>
      <div
        className="prose prose-sm dark:prose-invert max-w-none p-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollArea>
  );
}
