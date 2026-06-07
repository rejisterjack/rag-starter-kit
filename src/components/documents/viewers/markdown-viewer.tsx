'use client';

import dynamic from 'next/dynamic';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <div className="p-6 animate-pulse text-muted-foreground">Loading...</div>,
});

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <ScrollArea className={className ?? 'h-full'}>
      <div className="prose prose-sm dark:prose-invert max-w-none p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  );
}
