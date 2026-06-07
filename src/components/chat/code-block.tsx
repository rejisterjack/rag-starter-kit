'use client';

import { Check, Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: ReactNode;
  rawText?: string;
  language?: string;
  className?: string;
}

/** Extract plain text from React nodes (handles rehype-highlight spans). */
function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children: ReactNode } }).props.children);
  }
  return '';
}

export function CodeBlock({ children, rawText, language = 'text', className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const textForCopy = rawText ?? extractText(children);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(textForCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative my-4 overflow-hidden rounded-lg border bg-muted/50', className)}>
      <div className="flex items-center justify-between border-b bg-muted px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {language || 'text'}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 gap-1.5 px-2 text-xs">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>

      <div className="relative overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code className="block">{children}</code>
        </pre>
      </div>
    </div>
  );
}
