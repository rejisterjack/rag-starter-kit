'use client';

import {
  Archive,
  CheckCircle2,
  FileCode2,
  FileText,
  FileType2,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import type { ExportFormat, ExportProgress as ExportProgressType } from '@/lib/export';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface ExportProgressProps {
  progress: ExportProgressType | null;
  completed?: boolean;
  error?: string | null;
  format?: ExportFormat;
  onCancel?: () => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getFormatIcon(format?: ExportFormat) {
  switch (format) {
    case 'pdf':
      return <FileText className="h-8 w-8 text-red-500" />;
    case 'word':
      return <FileType2 className="h-8 w-8 text-blue-500" />;
    case 'markdown':
      return <FileCode2 className="h-8 w-8 text-gray-500" />;
    default:
      return <Archive className="h-8 w-8 text-primary" />;
  }
}

function getStatusColor(status: ExportProgressType['status']) {
  switch (status) {
    case 'completed':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    case 'cancelled':
      return 'text-gray-500';
    default:
      return 'text-blue-500';
  }
}

function getStatusIcon(status: ExportProgressType['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'cancelled':
      return <X className="h-5 w-5 text-gray-500" />;
    default:
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
  }
}

// =============================================================================
// Component
// =============================================================================

export function ExportProgress({
  progress,
  completed = false,
  error,
  format,
  onCancel,
  className,
}: ExportProgressProps) {
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <XCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Show completed state
  if (completed || progress?.status === 'completed') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 space-y-4', className)}>
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
          <div className="relative bg-green-100 rounded-full p-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium text-lg">Export Complete!</p>
          <p className="text-sm text-muted-foreground">Your file is ready for download</p>
        </div>
      </div>
    );
  }

  // Show cancelled state
  if (progress?.status === 'cancelled') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 space-y-4', className)}>
        <div className="bg-gray-100 rounded-full p-4">
          <X className="h-8 w-8 text-gray-600" />
        </div>
        <div className="text-center">
          <p className="font-medium text-lg">Export Cancelled</p>
          <p className="text-sm text-muted-foreground">The export was cancelled by the user</p>
        </div>
      </div>
    );
  }

  // Calculate progress percentage
  const progressValue = progress?.progress ?? 0;
  const isIndeterminate = progressValue === 0 && progress?.status === 'processing';

  return (
    <div className={cn('space-y-6 py-4', className)}>
      {/* Icon and Status */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="bg-primary/10 rounded-full p-3">{getFormatIcon(format)}</div>
          {progress?.status === 'processing' && (
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getStatusIcon(progress?.status ?? 'processing')}
            <span className={cn('font-medium', getStatusColor(progress?.status ?? 'processing'))}>
              {progress?.currentStep ?? 'Initializing...'}
            </span>
          </div>

          {progress && progress.totalItems > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Processing {progress.processedItems} of {progress.totalItems} items
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{Math.round(progressValue)}%</span>
        </div>
        <Progress value={isIndeterminate ? undefined : progressValue} className="h-2" />
      </div>

      {/* Processing Steps */}
      {progress?.status === 'processing' && (
        <div className="bg-muted rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex gap-1">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  progressValue > 20 ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  progressValue > 50 ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  progressValue > 80 ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
            </div>
            <span>
              {progressValue < 30
                ? 'Fetching conversation data...'
                : progressValue < 60
                  ? 'Generating document...'
                  : progressValue < 90
                    ? 'Formatting citations...'
                    : 'Finalizing export...'}
            </span>
          </div>
        </div>
      )}

      {/* Cancel Button */}
      {onCancel && progress?.status === 'processing' && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel Export
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Compact Progress Variant
// =============================================================================

export interface CompactExportProgressProps {
  progress: ExportProgressType | null;
  className?: string;
}

export function CompactExportProgress({ progress, className }: CompactExportProgressProps) {
  if (!progress) return null;

  return (
    <div className={cn('flex items-center gap-3 text-sm', className)}>
      {progress.status === 'processing' ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : progress.status === 'completed' ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : progress.status === 'failed' ? (
        <XCircle className="h-4 w-4 text-red-500" />
      ) : (
        <div className="h-4 w-4 rounded-full bg-muted" />
      )}

      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{progress.currentStep}</p>
      </div>

      <span className="text-muted-foreground tabular-nums">{Math.round(progress.progress)}%</span>
    </div>
  );
}

// =============================================================================
// Inline Progress Variant
// =============================================================================

export interface InlineExportProgressProps {
  progress: ExportProgressType | null;
  showPercentage?: boolean;
  className?: string;
}

export function InlineExportProgress({
  progress,
  showPercentage = true,
  className,
}: InlineExportProgressProps) {
  if (!progress) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {progress.status === 'processing' && (
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      )}

      <Progress value={progress.progress} className="h-1.5 w-24" />

      {showPercentage && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(progress.progress)}%
        </span>
      )}
    </div>
  );
}

export default ExportProgress;
