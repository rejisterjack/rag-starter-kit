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
        <Badge variant="success" className="gap-1 text-[10px] px-2 py-0.5 h-5">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Ready
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] px-2 py-0.5 h-5">
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          Processing{progress !== undefined ? ` ${Math.round(progress)}%` : ''}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="gap-1 text-[10px] px-2 py-0.5 h-5">
          <Clock className="h-2.5 w-2.5" />
          Pending
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="gap-1 text-[10px] px-2 py-0.5 h-5">
          <AlertCircle className="h-2.5 w-2.5" />
          Error
        </Badge>
      );
  }
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
  const FileIcon = getFileIcon(document.type);

  return (
    <div
      style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%' }}
      className={cn(
        'group relative rounded-xl border border-white/8 bg-white/4 p-3 transition-all',
        'hover:border-primary/30 hover:bg-white/6 hover:shadow-sm',
        isSelected && 'border-primary/40 ring-1 ring-primary/20 bg-primary/5',
        isMutating && 'opacity-60 pointer-events-none',
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
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-xl z-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {/* Top row: icon + name + menu */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          width: '100%',
          minWidth: 0,
        }}
      >
        {/* File icon — fixed size, never shrinks */}
        <div
          style={{ flexShrink: 0, width: '32px', height: '32px' }}
          className="flex items-center justify-center rounded-lg bg-muted"
        >
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Middle: name + meta — takes remaining space, clips overflow */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {/* Name row with menu button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              width: '100%',
              minWidth: 0,
            }}
          >
            <p
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: '1.4',
              }}
              title={document.name}
            >
              {document.name}
            </p>
            {/* Menu button — fixed size, never shrinks */}
            <div style={{ flexShrink: 0 }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Actions for ${document.name}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl backdrop-blur-xl p-1"
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
          <p
            style={{
              fontSize: '11px',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            className="text-muted-foreground"
          >
            {formatFileSize(document.size)}
            <span className="mx-1">·</span>
            <span title={formatDate(document.createdAt)}>
              {formatRelativeTime(document.createdAt)}
            </span>
          </p>

          {/* Status badge */}
          <div className="mt-2">
            <StatusBadge status={document.status} progress={document.progress} />
          </div>

          {/* Ingestion progress */}
          {(document.status === 'processing' || document.status === 'pending') && (
            <div className="mt-1.5">
              <IngestionProgress
                documentId={document.id}
                workspaceId={document.workspaceId}
                initialStatus={document.status}
              />
            </div>
          )}

          {document.status === 'processing' && document.progress !== undefined && (
            <Progress value={document.progress} className="h-1 mt-1.5" />
          )}

          {document.status === 'completed' && document.chunkCount !== undefined && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {document.chunkCount} chunks indexed
            </p>
          )}

          {document.status === 'error' && document.errorMessage && (
            <div className="mt-1.5 space-y-1" role="alert" aria-live="assertive">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', minWidth: 0 }}>
                {document.errorCategory && document.errorCategory !== 'UNKNOWN' && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] px-1.5 py-0 border-destructive/30 text-destructive bg-destructive/5"
                  >
                    {ERROR_CATEGORY_LABELS[document.errorCategory]}
                  </Badge>
                )}
                <p
                  style={{
                    fontSize: '11px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                  className="text-destructive"
                >
                  {document.errorMessage}
                </p>
              </div>
              {document.errorCategory && ERROR_REMEDIATION[document.errorCategory] && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '4px',
                          cursor: 'help',
                        }}
                      >
                        <Info className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                        <p
                          style={{
                            fontSize: '11px',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                          className="text-muted-foreground"
                        >
                          {ERROR_REMEDIATION[document.errorCategory]}
                        </p>
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
