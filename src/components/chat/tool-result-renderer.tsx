'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Calculator,
  ChevronDown,
  Code2,
  FileText,
  Globe,
  Loader2,
  Search,
  Wrench,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

export interface ToolResultRendererProps {
  content: string;
  toolCalls?: ToolCall[];
}

// ============================================================================
// Tool type classification
// ============================================================================

type ToolCategory = 'calculator' | 'web_search' | 'document' | 'code' | 'generic';

function classifyTool(name: string): ToolCategory {
  if (name === 'calculator') return 'calculator';
  if (name === 'web_search') return 'web_search';
  if (
    name === 'document_search' ||
    name === 'document_summary' ||
    name === 'document_metadata' ||
    name === 'semantic_search' ||
    name === 'compare_documents'
  )
    return 'document';
  if (name === 'code_executor' || name === 'code') return 'code';
  return 'generic';
}

const TOOL_COLORS: Record<
  ToolCategory,
  { border: string; bg: string; icon: string; badge: string }
> = {
  calculator: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400',
  },
  web_search: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    icon: 'text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400',
  },
  document: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  code: {
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
    icon: 'text-purple-400',
    badge: 'bg-purple-500/10 text-purple-400',
  },
  generic: {
    border: 'border-gray-500/30',
    bg: 'bg-gray-500/5',
    icon: 'text-gray-400',
    badge: 'bg-gray-500/10 text-gray-400',
  },
};

const TOOL_ICONS: Record<ToolCategory, React.ElementType> = {
  calculator: Calculator,
  web_search: Globe,
  document: FileText,
  code: Code2,
  generic: Wrench,
};

const TOOL_LABELS: Record<string, string> = {
  calculator: 'Calculator',
  web_search: 'Web Search',
  document_search: 'Document Search',
  document_summary: 'Document Summary',
  document_metadata: 'Document Info',
  semantic_search: 'Semantic Search',
  compare_documents: 'Compare Documents',
  code_executor: 'Code Execution',
  current_time: 'Current Time',
};

// ============================================================================
// Individual tool result renderers
// ============================================================================

function CalculatorResult({ result }: { result: unknown }) {
  const data = typeof result === 'object' && result !== null ? result : null;
  const expression =
    data && 'expression' in data ? (data as { expression: string }).expression : '';
  const answer = data && 'result' in data ? String((data as { result: unknown }).result) : '';

  if (!expression && !answer) {
    return (
      <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{formatRaw(result)}</pre>
    );
  }

  return (
    <div className="space-y-2">
      {expression && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" />
          <span className="font-mono">{expression}</span>
        </div>
      )}
      {answer && <div className="text-lg font-semibold text-emerald-400 font-mono">= {answer}</div>}
    </div>
  );
}

function WebSearchResult({ result }: { result: unknown }) {
  let results: Array<{ title?: string; url?: string; snippet?: string }> = [];

  if (typeof result === 'object' && result !== null) {
    if ('results' in result && Array.isArray((result as { results: unknown }).results)) {
      results = (result as { results: Array<{ title?: string; url?: string; snippet?: string }> })
        .results;
    } else if (Array.isArray(result)) {
      results = result as Array<{ title?: string; url?: string; snippet?: string }>;
    }
  }

  if (results.length === 0) {
    return (
      <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{formatRaw(result)}</pre>
    );
  }

  return (
    <ul className="space-y-2">
      {results.slice(0, 5).map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: search results may lack unique ids
        <li key={i} className="flex items-start gap-2">
          <Search className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400/60" />
          <div className="min-w-0">
            {item.title && (
              <p className="text-sm font-medium text-foreground/90 truncate">{item.title}</p>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 truncate block"
              >
                {item.url}
              </a>
            )}
            {item.snippet && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.snippet}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DocumentResult({ result }: { result: unknown }) {
  const data = typeof result === 'object' && result !== null ? result : null;

  if (data && 'documents' in data && Array.isArray((data as { documents: unknown }).documents)) {
    const docs = (data as { documents: Array<{ name?: string; id?: string; content?: string }> })
      .documents;
    return (
      <ul className="space-y-2">
        {docs.map((doc, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: items lack stable ids
          <li key={i} className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400/60" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground/90 truncate">
                {doc.name ?? `Document ${i + 1}`}
              </p>
              {doc.content && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{doc.content}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{formatRaw(result)}</pre>;
}

function CodeResult({ result }: { result: unknown }) {
  const data = typeof result === 'object' && result !== null ? result : null;
  const output = data && 'output' in data ? String((data as { output: unknown }).output) : '';
  const code = data && 'code' in data ? String((data as { code: unknown }).code) : '';

  return (
    <div className="space-y-2">
      {code && (
        <div className="rounded-md bg-black/20 border border-purple-500/10 p-2">
          <pre className="text-xs text-purple-300/90 font-mono whitespace-pre-wrap overflow-x-auto">
            {code}
          </pre>
        </div>
      )}
      {output && (
        <div className="rounded-md bg-black/30 border border-white/5 p-2">
          <p className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{output}</p>
        </div>
      )}
      {!code && !output && (
        <pre className="text-xs text-foreground/80 whitespace-pre-wrap">{formatRaw(result)}</pre>
      )}
    </div>
  );
}

function GenericResult({ result }: { result: unknown }) {
  return (
    <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono">
      {formatRaw(result)}
    </pre>
  );
}

// ============================================================================
// Tool result card (collapsible)
// ============================================================================

function ToolResultCard({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const category = classifyTool(toolCall.name);
  const colors = TOOL_COLORS[category];
  const IconComponent = TOOL_ICONS[category];
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;

  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending';
  const isError = toolCall.status === 'error';

  const ResultRenderer = useMemo(() => {
    switch (category) {
      case 'calculator':
        return CalculatorResult;
      case 'web_search':
        return WebSearchResult;
      case 'document':
        return DocumentResult;
      case 'code':
        return CodeResult;
      default:
        return GenericResult;
    }
  }, [category]);

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all',
        colors.border,
        isError ? 'border-red-500/30 bg-red-500/5' : colors.bg
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isRunning ? (
          <Loader2 className={cn('h-3.5 w-3.5 animate-spin', colors.icon)} />
        ) : (
          <IconComponent className={cn('h-3.5 w-3.5', colors.icon)} />
        )}

        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', colors.badge)}>
          {label}
        </span>

        {isError && <span className="text-xs text-red-400 ml-1">Failed</span>}

        <div className="flex-1" />

        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && !isRunning && toolCall.result !== undefined && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-white/5">
              {isError ? (
                <p className="text-xs text-red-400">{toolCall.error ?? 'Unknown error'}</p>
              ) : (
                <ResultRenderer result={toolCall.result} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Inline tool call detector (for content that contains [Tool: name] markers)
// ============================================================================

function detectInlineToolCalls(
  content: string
): Array<{ match: string; name: string; start: number; end: number }> {
  const pattern = /\[Tool:\s*(\w+)\]\s*([\s\S]*?)(?=\[Tool:|$)/gi;
  const matches: Array<{ match: string; name: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
  while ((m = pattern.exec(content)) !== null) {
    matches.push({
      match: m[0],
      name: m[1],
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  return matches;
}

// ============================================================================
// Main component
// ============================================================================

export function ToolResultRenderer({ content, toolCalls }: ToolResultRendererProps) {
  // Only render if there are explicit tool calls or inline markers
  const inlineCalls = useMemo(() => detectInlineToolCalls(content), [content]);
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasInlineCalls = inlineCalls.length > 0;

  if (!hasToolCalls && !hasInlineCalls) {
    return null;
  }

  return (
    <div className="space-y-2 mt-2">
      {hasToolCalls && toolCalls.map((tc) => <ToolResultCard key={tc.id} toolCall={tc} />)}

      {hasInlineCalls &&
        inlineCalls.map((ic, idx) => (
          <ToolResultCard
            // biome-ignore lint/suspicious/noArrayIndexKey: items lack stable ids
            key={`inline-${idx}`}
            toolCall={{
              id: `inline-${idx}`,
              name: ic.name,
              arguments: {},
              result: ic.match.replace(/\[Tool:\s*\w+\]\s*/, '').trim(),
              status: 'completed',
            }}
          />
        ))}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatRaw(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error: unknown) {
    return String(value);
  }
}
