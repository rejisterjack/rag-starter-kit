'use client';

import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-8 bg-transparent">
      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
        <FileText className="h-10 w-10 text-muted-foreground/70" />
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold text-foreground text-sm">Preview not available</p>
        <p className="text-xs text-muted-foreground/60">
          This file type cannot be displayed in the browser.
        </p>
      </div>
      {url && (
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
            <Download className="h-4 w-4" />
            Download File
          </Button>
        </a>
      )}
    </div>
  );
}
