'use client';

import { Download, FileText } from 'lucide-react';
import { TextViewer } from './text-viewer';

interface FallbackViewerProps {
  content?: string;
  url?: string;
  fileName?: string;
  className?: string;
}

export function FallbackViewer({ content, url, fileName, className }: FallbackViewerProps) {
  if (content) {
    return <TextViewer content={content} className={className} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <FileText className="h-8 w-8" />
      <p className="text-sm">Preview not available for this file type</p>
      {url && (
        <a
          href={url}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-primary underline text-sm"
        >
          <Download className="h-3.5 w-3.5" />
          Download file
        </a>
      )}
    </div>
  );
}
