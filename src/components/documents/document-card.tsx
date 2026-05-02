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
  workspaceId?: string;
}

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: string) => void;
  onReingest?: (id: string) => void;
  onPreview?: (document: Document) => void;
  isSelected?: boolean;
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
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" className="gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Processing{progress !== undefined ? ` ${Math.round(progress)}%` : ''}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
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
  className,
}: DocumentCardProps) {
  const FileIcon = getFileIcon(document.type);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Interactive element with conditional role, tabIndex, and keyboard handler
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: Conditional ARIA props based on interactive state
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        isSelected && 'border-primary ring-1 ring-primary',
        onPreview && 'cursor-pointer',
        className
      )}
      onClick={() => onPreview?.(document)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPreview?.(document);
        }
      }}
      role={onPreview ? 'button' : undefined}
      tabIndex={onPreview ? 0 : undefined}
      aria-label={onPreview ? `Preview document: ${document.name}` : undefined}
    >
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Document info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate text-sm font-medium" title={document.name}>
              {document.name}
            </h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPreview?.(document)}>
                  Preview document
                </DropdownMenuItem>
                {document.status === 'error' && onReingest && (
                  <DropdownMenuItem onClick={() => onReingest(document.id)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-ingest
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(document.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Meta info */}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(document.size)}</span>
            <span>·</span>
            <span title={formatDate(document.createdAt)}>
              {formatRelativeTime(document.createdAt)}
            </span>
          </div>

          {/* Status and progress */}
          <div className="mt-2 space-y-2">
            <StatusBadge status={document.status} progress={document.progress} />

            {(document.status === 'processing' || document.status === 'pending') && (
              <IngestionProgress
                documentId={document.id}
                workspaceId={document.workspaceId}
                initialStatus={document.status}
              />
            )}

            {document.status === 'processing' && document.progress !== undefined && (
              <Progress value={document.progress} className="h-1" />
            )}

            {document.status === 'completed' && document.chunkCount !== undefined && (
              <p className="text-xs text-muted-foreground">{document.chunkCount} chunks indexed</p>
            )}

            {document.status === 'error' && document.errorMessage && (
              <p className="text-xs text-destructive line-clamp-2">{document.errorMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
