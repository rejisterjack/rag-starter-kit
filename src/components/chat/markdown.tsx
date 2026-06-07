'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import 'katex/dist/katex.min.css';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';
import { CitationLink } from './citations';
import { CodeBlock } from './code-block';

interface MarkdownProps {
  content: string;
  className?: string;
  onCitationClick?: (index: number) => void;
}

// Regex to match citation patterns like [1], [2], etc.
const CITATION_REGEX = /\[(\d+)\]/g;

// Lazy load react-markdown to reduce initial bundle size.
// While the module loads, show the raw content as a simple text fallback
// so streaming messages still display content immediately.
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-muted-foreground">Loading...</div>,
});

export function Markdown({ content, className, onCitationClick }: MarkdownProps) {
  const citationCounter = React.useRef(0);

  // Pre-process content to handle citations
  const processedContent = React.useMemo(() => {
    citationCounter.current = 0;
    return content;
  }, [content]);

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className;

            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground"
                  {...(props as React.HTMLAttributes<HTMLElement>)}
                >
                  {children}
                </code>
              );
            }

            // Extract plain text for the copy button (children may be React elements from rehype-highlight)
            const extractText = (node: React.ReactNode): string => {
              if (typeof node === 'string') return node;
              if (typeof node === 'number') return String(node);
              if (!node) return '';
              if (Array.isArray(node)) return node.map(extractText).join('');
              if (typeof node === 'object' && 'props' in node)
                return extractText(
                  (node as { props: { children: React.ReactNode } }).props.children
                );
              return '';
            };
            const rawText = extractText(children).replace(/\n$/, '');

            return (
              <CodeBlock
                language={language}
                rawText={rawText}
                {...(props as Record<string, unknown>)}
              >
                {children}
              </CodeBlock>
            );
          },

          // Custom link rendering - open in new tab
          a({ href, children, ...props }) {
            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                className="text-primary hover:underline underline-offset-4"
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
              >
                {children}
              </a>
            );
          },

          // Custom paragraph rendering to handle inline citations
          p({ children }) {
            // Process children to find citation patterns
            const processedChildren = React.Children.map(children, (child) => {
              if (typeof child === 'string') {
                // Split by citation pattern and render citations as links
                const parts = child.split(CITATION_REGEX);
                if (parts.length === 1) return child;

                return parts.map((part, index) => {
                  // Even indices are text, odd indices are citation numbers
                  if (index % 2 === 0) {
                    return part;
                  }
                  const citationIndex = parseInt(part, 10);
                  const uniqueKey = `cit-${citationCounter.current++}`;
                  return (
                    <CitationLink key={uniqueKey} index={citationIndex} onClick={onCitationClick} />
                  );
                });
              }
              return child;
            });

            return <p className="mb-4 last:mb-0 leading-7">{processedChildren}</p>;
          },

          // Table styling
          table({ children }) {
            return (
              <div className="my-6 w-full overflow-y-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="border-b border-border">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border-b border-border px-4 py-2 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border-b border-border px-4 py-2">{children}</td>;
          },

          // List styling
          ul({ children }) {
            return <ul className="my-4 ml-6 list-disc marker:text-muted-foreground">{children}</ul>;
          },
          ol({ children }) {
            return (
              <ol className="my-4 ml-6 list-decimal marker:text-muted-foreground">{children}</ol>
            );
          },
          li({ children }) {
            return <li className="mt-2">{children}</li>;
          },

          // Heading styling
          h1({ children }) {
            return <h1 className="mt-8 mb-4 text-2xl font-bold tracking-tight">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mt-8 mb-4 text-xl font-semibold tracking-tight">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mt-6 mb-3 text-lg font-semibold tracking-tight">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="mt-6 mb-3 text-base font-semibold tracking-tight">{children}</h4>;
          },

          // Blockquote styling
          blockquote({ children }) {
            return (
              <blockquote className="mt-4 border-l-2 border-primary pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },

          // Horizontal rule
          hr() {
            return <hr className="my-6 border-border" />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
