'use client';

import DOMPurify from 'dompurify';
import { Code, Eye } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HtmlViewerProps {
  content: string;
  className?: string;
}

export function HtmlViewer({ content, className }: HtmlViewerProps) {
  const [showSource, setShowSource] = useState(false);
  const sanitized = DOMPurify.sanitize(content);

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      <div className="flex items-center justify-end px-4 py-1.5 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowSource(!showSource)}
        >
          {showSource ? <Eye className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
          {showSource ? 'Preview' : 'Source'}
        </Button>
      </div>

      {showSource ? (
        <ScrollArea className="flex-1">
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">{content}</pre>
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1">
          <div
            className="p-6 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        </ScrollArea>
      )}
    </div>
  );
}
