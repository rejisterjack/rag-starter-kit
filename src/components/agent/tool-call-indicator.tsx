'use client';

import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Globe,
  Loader2,
  Search,
  Wrench,
  XCircle,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Represents a tool call with its state and result */
export interface ToolCall {
  /** Unique identifier for the tool call */
  id: string;
  /** Name of the tool being called */
  tool: string;
  /** Input parameters */
  input: Record<string, unknown>;
  /** Current status of the tool call */
  status: 'pending' | 'running' | 'success' | 'error';
  /** Result data (if successful) */
  result?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Timestamp when the call started */
  startedAt?: Date;
  /** Timestamp when the call completed */
  completedAt?: Date;
  /** Execution duration in milliseconds */
  duration?: number;
}

export interface ToolCallIndicatorProps {
  /** Tool call data to display */
  toolCall: ToolCall;
  /** Whether to show expanded details */
  defaultExpanded?: boolean;
  /** Optional className for styling */
  className?: string;
}

/**
 * Shows when tools are being called with loading states for tool execution
 * and tool results display
 */
export function ToolCallIndicator({
  toolCall,
  defaultExpanded = false,
  className,
}: ToolCallIndicatorProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const Icon = getToolIcon(toolCall.tool);

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        toolCall.status === 'running' &&
          'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30',
        toolCall.status === 'success' &&
          'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30',
        toolCall.status === 'error' &&
          'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30',
        toolCall.status === 'pending' && 'border-muted bg-muted/30',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        {/* Status Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
          {toolCall.status === 'running' ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          ) : toolCall.status === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : toolCall.status === 'error' ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-sm truncate">{formatToolName(toolCall.tool)}</span>
            <StatusBadge status={toolCall.status} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {toolCall.status === 'running' ? (
              <span className="flex items-center gap-1">
                Executing
                <span className="inline-flex gap-0.5">
                  <span className="h-0.5 w-0.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-0.5 w-0.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-0.5 w-0.5 rounded-full bg-current animate-bounce" />
                </span>
              </span>
            ) : (
              <>
                {toolCall.status === 'success' && <span>Completed</span>}
                {toolCall.status === 'error' && <span>Failed</span>}
                {toolCall.status === 'pending' && <span>Queued</span>}
              </>
            )}
            {toolCall.duration && (
              <>
                <span>·</span>
                <span>{formatDuration(toolCall.duration)}</span>
              </>
            )}
          </div>
        </div>

        {/* Expand Icon */}
        <div className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t px-3 pb-3">
          <div className="space-y-3 pt-3">
            {/* Input Parameters */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Input Parameters</h4>
              <pre className="text-xs bg-background/80 rounded p-2 overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>

            {/* Result or Error */}
            {toolCall.status === 'success' && toolCall.result !== undefined && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Result</h4>
                <div className="text-xs bg-background/80 rounded p-2 overflow-x-auto">
                  {typeof toolCall.result === 'string' ? (
                    <p>{toolCall.result}</p>
                  ) : (
                    <pre>{JSON.stringify(toolCall.result, null, 2)}</pre>
                  )}
                </div>
              </div>
            )}

            {toolCall.status === 'error' && toolCall.error && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Error</h4>
                <div className="text-xs bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-200 rounded p-2">
                  {toolCall.error}
                </div>
              </div>
            )}

            {/* Timestamps */}
            {(toolCall.startedAt || toolCall.completedAt) && (
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                {toolCall.startedAt && (
                  <span>Started: {toolCall.startedAt.toLocaleTimeString()}</span>
                )}
                {toolCall.completedAt && (
                  <span>Completed: {toolCall.completedAt.toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface ToolCallGroupProps {
  /** Array of tool calls to display */
  toolCalls: ToolCall[];
  /** Title for the group */
  title?: string;
  /** Whether to show in a card container */
  inCard?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: number;
  /** Optional className for styling */
  className?: string;
}

/**
 * Display a group of tool calls
 */
export function ToolCallGroup({
  toolCalls,
  title = 'Tool Calls',
  inCard = true,
  maxHeight = 300,
  className,
}: ToolCallGroupProps) {
  const runningCount = toolCalls.filter((t) => t.status === 'running').length;
  const completedCount = toolCalls.filter((t) => t.status === 'success').length;
  const errorCount = toolCalls.filter((t) => t.status === 'error').length;

  const content = (
    <div className={cn('space-y-2', className)}>
      {toolCalls.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">No tool calls yet</div>
      ) : (
        toolCalls.map((toolCall) => <ToolCallIndicator key={toolCall.id} toolCall={toolCall} />)
      )}
    </div>
  );

  if (inCard) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" />
            {title}
            <div className="ml-auto flex items-center gap-2">
              {runningCount > 0 && (
                <Badge variant="outline" className="text-xs text-amber-600">
                  {runningCount} running
                </Badge>
              )}
              {completedCount > 0 && (
                <Badge variant="outline" className="text-xs text-green-600">
                  {completedCount} completed
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="outline" className="text-xs text-red-600">
                  {errorCount} failed
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className={maxHeight ? `max-h-[${maxHeight}px]` : undefined}>
            {content}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return content;
}

/**
 * Compact inline indicator for a tool call
 */
export function ToolCallInline({
  toolCall,
  className,
}: {
  toolCall: ToolCall;
  className?: string;
}) {
  const Icon = getToolIcon(toolCall.tool);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
        toolCall.status === 'running' && 'border-amber-200 bg-amber-50 text-amber-800',
        toolCall.status === 'success' && 'border-green-200 bg-green-50 text-green-800',
        toolCall.status === 'error' && 'border-red-200 bg-red-50 text-red-800',
        toolCall.status === 'pending' && 'border-muted bg-muted',
        className
      )}
    >
      {toolCall.status === 'running' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      <span>{formatToolName(toolCall.tool)}</span>
    </div>
  );
}

/**
 * Skeleton loader for tool call indicator
 */
export function ToolCallSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg border border-muted', className)}>
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ToolCall['status'] }) {
  const variants: Record<string, { label: string; className: string }> = {
    pending: {
      label: 'Queued',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
    running: {
      label: 'Running',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    },
    success: {
      label: 'Success',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    error: {
      label: 'Error',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
  };

  const variant = variants[status];

  return (
    <Badge variant="outline" className={cn('text-[10px] h-4 px-1 font-normal', variant.className)}>
      {variant.label}
    </Badge>
  );
}

function getToolIcon(toolName: string): React.ComponentType<{ className?: string }> {
  const name = toolName.toLowerCase();
  if (name.includes('search') || name.includes('retrieve')) return Search;
  if (name.includes('calculat') || name.includes('math')) return Calculator;
  if (name.includes('web') || name.includes('internet')) return Globe;
  if (name.includes('document') || name.includes('file')) return FileText;
  return Wrench;
}

function formatToolName(toolName: string): string {
  return toolName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
