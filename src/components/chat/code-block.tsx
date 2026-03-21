'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  children,
  language = 'text',
  className,
  showLineNumbers = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = children.split('\n');

  return (
    <div className={cn('relative my-4 overflow-hidden rounded-lg border bg-muted/50', className)}>
      {/* Header with language and copy button */}
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

      {/* Code content */}
      <div className="relative overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          {showLineNumbers ? (
            <div className="flex">
              <div className="select-none pr-4 text-right text-muted-foreground">
                {lines.map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Line numbers are stable based on position
                  <div key={`line-${i}`} className="leading-relaxed">
                    {i + 1}
                  </div>
                ))}
              </div>
              <code className="block flex-1">{children}</code>
            </div>
          ) : (
            <code className="block">{children}</code>
          )}
        </pre>
      </div>
    </div>
  );
}
