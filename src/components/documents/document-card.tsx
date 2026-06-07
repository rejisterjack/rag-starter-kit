'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  File,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ERROR_CATEGORY_LABELS,
  ERROR_REMEDIATION,
  type ErrorCategory,
} from '@/lib/rag/ingestion/errors';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import { IngestionProgress } from './ingestion-progress';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: DocumentStatus;
  progress?: number;
  chunkCount?: number;
  storageUrl?: string;
  content?: string;
  createdAt: Date;
  errorMessage?: string;
  errorCategory?: ErrorCategory;
  workspaceId?: string;
}

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: string) => void;
  onReingest?: (id: string) => void;
  onPreview?: (document: Document) => void;
  isSelected?: boolean;
  isMutating?: boolean;
  className?: string;
}

const FILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'application/pdf': FileText,
  'text/plain': FileText,
  'text/markdown': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'text/csv': FileSpreadsheet,
  'image/': FileImage,
  'text/html': FileCode,
  'application/json': FileCode,
};

function getFileIcon(type: string) {
  for (const [prefix, Icon] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(prefix) || type === prefix) {
      return Icon;
    }
  }
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function StatusBadge({ status, progress }: { status: DocumentStatus; progress?: number }) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 shadow-[0_0_8px_rgba(16,185,129,0.06)]">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Ready
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 h-5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/15 shadow-[0_0_8px_rgba(59,130,246,0.06)]">
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          Processing{progress !== undefined ? ` ${Math.round(progress)}%` : ''}
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 h-5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15 shadow-[0_0_8px_rgba(245,158,11,0.06)]">
          <Clock className="h-2.5 w-2.5" />
          Pending
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 h-5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/15 shadow-[0_0_8px_rgba(244,63,94,0.06)]">
          <AlertCircle className="h-2.5 w-2.5" />
          Error
        </span>
      );
  }
}

function FileIconWrapper({ type, isSelected }: { type: string; isSelected?: boolean }) {
  const Icon = getFileIcon(type);

  // Determine colors based on mime types
  let colors = 'bg-slate-500/10 border-slate-500/20 text-slate-400';
  if (type === 'application/pdf') {
    colors = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
  } else if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword'
  ) {
    colors = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
  } else if (
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'text/csv'
  ) {
    colors = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
  } else if (type === 'text/html' || type === 'application/json' || type.startsWith('text/')) {
    colors = 'bg-violet-500/10 border-violet-500/20 text-violet-400';
  } else if (type.startsWith('image/')) {
    colors = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
  }

  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-300',
        colors,
        isSelected && 'shadow-[0_0_12px_rgba(139,92,246,0.1)]'
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

export function DocumentCard({
  document,
  onDelete,
  onReingest,
  onPreview,
  isSelected,
  isMutating = false,
  className,
}: DocumentCardProps) {
  return (
    <div
      style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%' }}
      className={cn(
        'group relative rounded-lg border p-3 transition-all duration-200 ease-out text-left',
        isSelected
          ? 'bg-primary/8 border-primary/25 shadow-[0_4px_16px_-4px_rgba(139,92,246,0.15)]'
          : 'bg-white/[0.01] hover:bg-white/[0.05] border-white/4 hover:border-white/10 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2)] hover:-translate-y-[0.5px] active:translate-y-0 active:bg-white/[0.03]',
        isMutating && 'opacity-50 pointer-events-none',
        onPreview && !isMutating && 'cursor-pointer',
        className
      )}
      onClick={() => !isMutating && onPreview?.(document)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          !isMutating && onPreview?.(document);
        }
      }}
      role={onPreview && !isMutating ? 'button' : undefined}
      tabIndex={onPreview && !isMutating ? 0 : undefined}
      aria-label={onPreview ? `Preview document: ${document.name}` : undefined}
    >
      {/* Loading overlay */}
      {isMutating && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-lg z-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {/* Selected Indicator Pill */}
      {isSelected && (
        <div
          className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-md bg-primary shadow-[0_0_8px_rgba(139,92,246,0.4)]"
          aria-hidden="true"
        />
      )}

      {/* Top row: icon + name + menu */}
      <div className="flex items-start gap-2.5 w-full min-w-0">
        <FileIconWrapper type={document.type} isSelected={isSelected} />

        {/* Content Section */}
        <div className="flex-1 min-w-0">
          {/* Name row with menu button */}
          <div className="flex items-center gap-1.5 w-full min-w-0">
            <p
              className={cn(
                'text-xs font-semibold truncate leading-5 flex-1 min-w-0 transition-colors duration-150',
                isSelected ? 'text-primary' : 'text-foreground/90 group-hover:text-foreground'
              )}
              title={document.name}
            >
              {document.name}
            </p>
            {/* Menu button — fixed size, never shrinks */}
            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Actions for ${document.name}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-lg border border-white/10 bg-[#1a1a2e] shadow-2xl backdrop-blur-xl p-1"
                >
                  <DropdownMenuItem
                    className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 focus:bg-white/8"
                    onClick={() => onPreview?.(document)}
                  >
                    <Info className="h-3.5 w-3.5" />
                    Preview document
                  </DropdownMenuItem>
                  {document.status === 'error' && onReingest && (
                    <DropdownMenuItem
                      className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 focus:bg-white/8"
                      onClick={() => onReingest(document.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Re-ingest
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/8 my-1" />
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(document.id)}
                      className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Meta: size · time */}
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground/60 overflow-hidden truncate">
            <span>{formatFileSize(document.size)}</span>
            <span className="text-white/10" aria-hidden="true">
              •
            </span>
            <span title={formatDate(document.createdAt)}>
              {formatRelativeTime(document.createdAt)}
            </span>
          </div>

          {/* Bottom details row: Status Badge + Chunk Count badge */}
          <div className="flex items-center justify-between gap-2 mt-2.5 w-full min-w-0">
            <StatusBadge status={document.status} progress={document.progress} />

            {document.status === 'completed' && document.chunkCount !== undefined && (
              <span className="flex items-center gap-0.5 bg-white/[0.03] border border-white/5 px-1.5 py-0.5 rounded-md font-mono text-[9px] text-muted-foreground/75 group-hover:border-white/10 transition-colors duration-150">
                {document.chunkCount} chunk{document.chunkCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Ingestion progress */}
          {(document.status === 'processing' || document.status === 'pending') && (
            <div className="mt-2">
              <IngestionProgress
                documentId={document.id}
                workspaceId={document.workspaceId}
                initialStatus={document.status}
              />
            </div>
          )}

          {document.status === 'processing' && document.progress !== undefined && (
            <Progress value={document.progress} className="h-1 mt-2 bg-white/5" />
          )}

          {document.status === 'error' && document.errorMessage && (
            <div
              className="mt-2 space-y-1 bg-destructive/5 border border-destructive/10 rounded-lg p-2"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start gap-1.5 min-w-0">
                {document.errorCategory && document.errorCategory !== 'UNKNOWN' && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[9px] px-1 py-0 border-destructive/30 text-destructive bg-destructive/5 font-semibold"
                  >
                    {ERROR_CATEGORY_LABELS[document.errorCategory]}
                  </Badge>
                )}
                <p className="text-[10px] text-destructive leading-tight flex-1 min-w-0 break-words">
                  {document.errorMessage}
                </p>
              </div>
              {document.errorCategory && ERROR_REMEDIATION[document.errorCategory] && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help mt-1 text-[9px] text-muted-foreground/75">
                        <Info className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                        <span className="truncate">Troubleshooting advice</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {ERROR_REMEDIATION[document.errorCategory]}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
