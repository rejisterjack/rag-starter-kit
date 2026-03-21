'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
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

export function Markdown({ content, className, onCitationClick }: MarkdownProps) {
  // Pre-process content to handle citations
  const processedContent = React.useMemo(() => {
    // Replace citation patterns with a special marker that we can handle in rendering
    return content;
  }, [content]);

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom code block rendering
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className;

            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={language} {...props}>
                {String(children).replace(/\n$/, '')}
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
                {...props}
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
                  return (
                    <CitationLink
                      key={`citation-${citationIndex}`}
                      index={citationIndex}
                      onClick={onCitationClick}
                    />
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
