'use client';

/**
 * Upload Dropzone Component
 *
 * Features:
 * - Drag & drop zone for file uploads
 * - File type icons
 * - Upload progress tracking
 * - Processing status indicator
 * - Error display with retry
 */

import {
  AlertCircle,
  CheckCircle,
  File as FileIcon,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { fetchWithCsrf } from '@/lib/security/csrf';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  documentId?: string;
}

export interface UploadDropzoneProps {
  /** Callback when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Callback when a file is removed */
  onFileRemove?: (fileId: string) => void;
  /** Callback when retry is requested */
  onRetry?: (fileId: string) => void;
  /** Currently uploading/processing files */
  files?: UploadFile[];
  /** Maximum file size in bytes (default: 50MB) */
  maxFileSize?: number;
  /** Allowed MIME types */
  accept?: Record<string, string[]>;
  /** Whether multiple files are allowed */
  multiple?: boolean;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Show URL input option */
  allowUrl?: boolean;
  /** Callback when URL is submitted */
  onUrlSubmit?: (url: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_ACCEPT: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'text/html': ['.html', '.htm'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="h-8 w-8 text-red-400" />,
  'application/msword': <FileText className="h-8 w-8 text-blue-400" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (
    <FileText className="h-8 w-8 text-blue-400" />
  ),
  'text/plain': <FileText className="h-8 w-8 text-muted-foreground" />,
  'text/markdown': <FileText className="h-8 w-8 text-purple-400" />,
  'text/csv': <FileText className="h-8 w-8 text-green-400" />,
  'application/json': <FileText className="h-8 w-8 text-yellow-400" />,
  'text/html': <Globe className="h-8 w-8 text-orange-400" />,
  'application/vnd.ms-excel': <FileText className="h-8 w-8 text-green-400" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (
    <FileText className="h-8 w-8 text-green-400" />
  ),
  default: <FileIcon className="h-8 w-8 text-muted-foreground" />,
};

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
  'text/csv': 'CSV',
  'application/json': 'JSON',
  'text/html': 'HTML',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
};

// =============================================================================
// Helpers
// =============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

// =============================================================================
// Component
// =============================================================================

export function UploadDropzone({
  onFilesSelected,
  onFileRemove,
  onRetry,
  files = [],
  maxFileSize = 50 * 1024 * 1024,
  accept = DEFAULT_ACCEPT,
  multiple = true,
  disabled = false,
  className,
  allowUrl = true,
  onUrlSubmit,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get file icon
  const getFileIcon = (type: string): React.ReactNode => {
    return FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS.default;
  };

  // Validate files with feedback
  const validateFiles = useCallback(
    (filesToValidate: File[]): { valid: File[]; rejected: string[] } => {
      const valid: File[] = [];
      const rejected: string[] = [];

      for (const file of filesToValidate) {
        // Check file size
        if (file.size > maxFileSize) {
          rejected.push(`${file.name}: exceeds ${formatFileSize(maxFileSize)} limit`);
          continue;
        }

        // Check file type
        const acceptedTypes = Object.keys(accept);
        const isAccepted = acceptedTypes.some((type) => {
          if (type.includes('*')) {
            return file.type.startsWith(type.replace('/*', ''));
          }
          return file.type === type;
        });

        const isExtAccepted = Object.values(accept)
          .flat()
          .some((ext) => file.name.toLowerCase().endsWith(ext));

        if (!isAccepted && !isExtAccepted) {
          rejected.push(`${file.name}: unsupported file type`);
          continue;
        }

        valid.push(file);
      }

      return { valid, rejected };
    },
    [maxFileSize, accept]
  );

  // Handle drag events
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      const { valid, rejected } = validateFiles(droppedFiles);

      for (const msg of rejected) {
        toast.error(msg);
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [disabled, onFilesSelected, validateFiles]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      const { valid, rejected } = validateFiles(selectedFiles);

      for (const msg of rejected) {
        toast.error(msg);
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onFilesSelected, validateFiles]
  );

  // Handle URL submit
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim() && onUrlSubmit) {
      onUrlSubmit(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  // Get status icon
  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-amber-400" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      default:
        return null;
    }
  };

  // Get status text
  const getStatusText = (file: UploadFile): string => {
    switch (file.status) {
      case 'uploading':
        return `Uploading... ${file.progress}%`;
      case 'processing':
        return `Processing... ${file.progress}%`;
      case 'completed':
        return 'Complete';
      case 'error':
        return file.error || 'Error';
      default:
        return formatFileSize(file.size);
    }
  };

  // Get progress bar color
  const getProgressColor = (status: UploadStatus): string => {
    switch (status) {
      case 'error':
        return 'bg-red-400';
      case 'completed':
        return 'bg-emerald-400';
      case 'processing':
        return 'bg-amber-400';
      default:
        return 'bg-primary';
    }
  };

  const acceptedLabels = [...new Set(Object.values(FILE_TYPE_LABELS))];

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) {
              inputRef.current?.click();
            }
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'relative cursor-pointer rounded-2xl border-2 border-dashed p-8 transition-all',
          'border-white/10 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10',
          isDragOver && 'border-primary/60 bg-primary/10 shadow-lg shadow-primary/15',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={Object.entries(accept)
            .map(([type, exts]) => `${type},${exts.join(',')}`)
            .join(',')}
          multiple={multiple}
          disabled={disabled}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <div className="rounded-2xl bg-primary/10 p-3 shadow-md shadow-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">
              Drop files here or click to upload
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, Word, Excel, CSV, Text, Markdown, JSON, HTML
            </p>
            <p className="text-xs text-muted-foreground/60">
              Maximum file size: {formatFileSize(maxFileSize)}
            </p>
          </div>

          {/* File type badges */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {acceptedLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full glass-light px-2.5 py-1 text-xs font-medium text-muted-foreground border border-white/10"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* URL Input */}
      {allowUrl && (
        <div className="space-y-2">
          {!showUrlInput ? (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              disabled={disabled}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed',
                'border-white/10 p-3 text-sm text-muted-foreground transition-all',
                'hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <Globe className="h-4 w-4" />
              <span>Or paste a URL to scrape</span>
            </button>
          ) : (
            <form onSubmit={handleUrlSubmit} className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                disabled={disabled}
                className="flex-1 rounded-xl border border-white/10 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={!urlInput.trim() || disabled}
                className="rounded-xl bg-gradient-to-br from-primary to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-primary/20 transition-all hover:shadow-primary/40 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                Scrape
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUrlInput(false);
                  setUrlInput('');
                }}
                disabled={disabled}
                className="rounded-xl border border-white/10 px-3 py-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                file.status === 'error' && 'border-red-400/30 bg-red-400/5',
                file.status === 'completed' && 'border-emerald-400/30 bg-emerald-400/5',
                file.status === 'processing' && 'border-amber-400/30 bg-amber-400/5',
                file.status !== 'error' &&
                  file.status !== 'completed' &&
                  file.status !== 'processing' &&
                  'border-white/10 glass-light'
              )}
            >
              {/* File Icon */}
              <div className="flex-shrink-0">{getFileIcon(file.type)}</div>

              {/* File Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p
                  className={cn(
                    'text-xs',
                    file.status === 'error' && 'text-red-400',
                    file.status === 'completed' && 'text-emerald-400',
                    file.status === 'processing' && 'text-amber-400',
                    file.status !== 'error' &&
                      file.status !== 'completed' &&
                      file.status !== 'processing' &&
                      'text-muted-foreground'
                  )}
                >
                  {getStatusText(file)}
                </p>

                {/* Progress Bar */}
                {(file.status === 'uploading' || file.status === 'processing') && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        getProgressColor(file.status)
                      )}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {getStatusIcon(file.status)}

                {file.status === 'error' && onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(file.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    title="Retry upload"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}

                {onFileRemove && (
                  <button
                    type="button"
                    onClick={() => onFileRemove(file.id)}
                    disabled={file.status === 'uploading' || file.status === 'processing'}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload More Button (when files exist and multiple is allowed) */}
      {files.length > 0 && multiple && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border',
            'border-dashed border-white/10 p-3 text-sm text-muted-foreground transition-all',
            'hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <Upload className="h-4 w-4" />
          <span>Add more files</span>
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Hook for managing uploads
// =============================================================================

export interface UseUploadOptions {
  /** API endpoint for uploads */
  endpoint?: string;
  /** Workspace ID for the upload */
  workspaceId?: string;
  /** Callback when upload completes */
  onUploadComplete?: (file: UploadFile, response: unknown) => void;
  /** Callback when upload fails */
  onUploadError?: (file: UploadFile, error: Error) => void;
}

export function useUpload(options: UseUploadOptions = {}) {
  const { endpoint = '/api/ingest', workspaceId, onUploadComplete, onUploadError } = options;
  const [files, setFiles] = useState<UploadFile[]>([]);

  // Upload a file - defined before addFiles to avoid TDZ
  const uploadFileFn = useCallback(
    async (fileToUpload: UploadFile) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileToUpload.id ? { ...f, status: 'uploading', progress: 0 } : f))
      );

      try {
        const formData = new FormData();
        formData.append('file', fileToUpload.file);
        if (workspaceId) {
          formData.append('workspaceId', workspaceId);
        }

        const response = await fetchWithCsrf(endpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Upload failed');
        }

        const data = await response.json();

        // Upload is done — mark as completed immediately.
        // Processing happens in the background (Inngest or direct) and shows in the sidebar.
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileToUpload.id
              ? {
                  ...f,
                  status: 'completed',
                  progress: 100,
                  documentId: data.data?.document?.id,
                }
              : f
          )
        );

        onUploadComplete?.(fileToUpload, data);
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileToUpload.id
              ? {
                  ...f,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : f
          )
        );

        onUploadError?.(fileToUpload, err instanceof Error ? err : new Error('Upload failed'));
      }
    },
    [endpoint, workspaceId, onUploadComplete, onUploadError]
  );

  // Add files to upload queue - defined last to use uploadFileFn
  const addFiles = useCallback(
    (newFiles: File[]) => {
      const uploadFilesList: UploadFile[] = newFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'idle',
        progress: 0,
      }));

      setFiles((prev) => [...prev, ...uploadFilesList]);

      // Start upload for each file
      uploadFilesList.forEach((file) => {
        uploadFileFn(file);
      });
    },
    [uploadFileFn]
  );

  // Remove a file from the list
  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Retry a failed upload
  const retryFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (file) {
        uploadFileFn(file);
      }
    },
    [files, uploadFileFn]
  );

  // Submit URL for scraping
  const submitUrl = useCallback(
    async (url: string) => {
      // Helper to create a File object safely
      const createPlaceholderFile = (filename: string): File => {
        const blob = new Blob([''], { type: 'text/html' });
        return new File([blob], filename, { type: 'text/html' });
      };

      const newUploadFile: UploadFile = {
        id: Math.random().toString(36).substr(2, 9),
        file: createPlaceholderFile(url),
        name: new URL(url).hostname,
        size: 0,
        type: 'text/html',
        status: 'uploading',
        progress: 0,
      };

      setFiles((prev) => [...prev, newUploadFile]);

      try {
        const formData = new FormData();
        formData.append('url', url);
        if (workspaceId) {
          formData.append('workspaceId', workspaceId);
        }

        const response = await fetchWithCsrf(endpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to queue URL');
        }

        const data = await response.json();

        // URL queued — mark as completed immediately.
        // Processing happens in the background and shows in the sidebar.
        setFiles((prev) =>
          prev.map((f) =>
            f.id === newUploadFile.id
              ? {
                  ...f,
                  status: 'completed',
                  progress: 100,
                  documentId: data.data?.document?.id,
                }
              : f
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === newUploadFile.id
              ? {
                  ...f,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Failed to scrape URL',
                }
              : f
          )
        );
      }
    },
    [endpoint, workspaceId]
  );

  return {
    files,
    addFiles,
    removeFile,
    retryFile,
    submitUrl,
  };
}

export default UploadDropzone;
