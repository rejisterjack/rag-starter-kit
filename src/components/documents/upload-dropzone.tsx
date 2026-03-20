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

import React, { useCallback, useState, useRef } from 'react';
import { 
  FileText, 
  File, 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Globe,
  RefreshCw,
} from 'lucide-react';

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
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'text/html': ['.html', '.htm'],
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="h-8 w-8 text-red-500" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (
    <FileText className="h-8 w-8 text-blue-500" />
  ),
  'text/plain': <FileText className="h-8 w-8 text-gray-500" />,
  'text/markdown': <FileText className="h-8 w-8 text-purple-500" />,
  'text/html': <Globe className="h-8 w-8 text-orange-500" />,
  'default': <File className="h-8 w-8 text-gray-400" />,
};

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
  'text/html': 'HTML',
};

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

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Get file icon
  const getFileIcon = (type: string): React.ReactNode => {
    return FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS['default'];
  };

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(droppedFiles);
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [disabled, onFilesSelected]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = validateFiles(selectedFiles);
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onFilesSelected]);

  // Validate files
  const validateFiles = (filesToValidate: File[]): File[] => {
    return filesToValidate.filter(file => {
      // Check file size
      if (file.size > maxFileSize) {
        console.warn(`File ${file.name} exceeds size limit`);
        return false;
      }

      // Check file type
      const acceptedTypes = Object.keys(accept);
      const isAccepted = acceptedTypes.some(type => {
        if (type.includes('*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return file.type === type;
      });

      if (!isAccepted && !Object.values(accept).flat().some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )) {
        console.warn(`File type ${file.type} not accepted`);
        return false;
      }

      return true;
    });
  };

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
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-amber-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
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
        return 'bg-red-500';
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-amber-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative cursor-pointer rounded-lg border-2 border-dashed p-8 transition-colors',
          'hover:border-gray-400 hover:bg-gray-50',
          isDragOver && 'border-blue-500 bg-blue-50',
          disabled && 'cursor-not-allowed opacity-50',
          files.length > 0 && !multiple && 'hidden'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={Object.entries(accept).map(([type, exts]) => `${type},${exts.join(',')}`).join(',')}
          multiple={multiple}
          disabled={disabled}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <div className="rounded-full bg-gray-100 p-3">
            <Upload className="h-6 w-6 text-gray-600" />
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-900">
              Drop files here or click to upload
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Support for PDF, Word, Markdown, and Text files
            </p>
            <p className="text-xs text-gray-400">
              Maximum file size: {formatFileSize(maxFileSize)}
            </p>
          </div>

          {/* File type badges */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {Object.entries(FILE_TYPE_LABELS).map(([mime, label]) => (
              <span
                key={mime}
                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
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
                'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed',
                'border-gray-300 p-3 text-sm text-gray-600 transition-colors',
                'hover:border-gray-400 hover:bg-gray-50',
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
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!urlInput.trim() || disabled}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
                className="rounded-lg border border-gray-300 px-3 py-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
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
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                file.status === 'error' && 'border-red-200 bg-red-50',
                file.status === 'completed' && 'border-green-200 bg-green-50',
                file.status === 'processing' && 'border-amber-200 bg-amber-50',
                file.status !== 'error' && file.status !== 'completed' && file.status !== 'processing' && 'border-gray-200 bg-white'
              )}
            >
              {/* File Icon */}
              <div className="flex-shrink-0">
                {getFileIcon(file.type)}
              </div>

              {/* File Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {file.name}
                </p>
                <p className={cn(
                  'text-xs',
                  file.status === 'error' && 'text-red-600',
                  file.status === 'completed' && 'text-green-600',
                  file.status === 'processing' && 'text-amber-600',
                  file.status !== 'error' && file.status !== 'completed' && file.status !== 'processing' && 'text-gray-500'
                )}>
                  {getStatusText(file)}
                </p>

                {/* Progress Bar */}
                {(file.status === 'uploading' || file.status === 'processing') && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={cn('h-full transition-all duration-300', getProgressColor(file.status))}
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
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
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
            'flex w-full items-center justify-center gap-2 rounded-lg border',
            'border-dashed border-gray-300 p-3 text-sm text-gray-600 transition-colors',
            'hover:border-gray-400 hover:bg-gray-50',
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

  // Add files to upload queue
  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'idle',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...uploadFiles]);

    // Start upload for each file
    uploadFiles.forEach(uploadFile);
  }, []);

  // Upload a file
  const uploadFile = useCallback(async (uploadFile: UploadFile) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      )
    );

    try {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      if (workspaceId) {
        formData.append('workspaceId', workspaceId);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Upload failed');
      }

      const data = await response.json();

      setFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'processing',
                progress: 0,
                documentId: data.data?.document?.id,
              }
            : f
        )
      );

      onUploadComplete?.(uploadFile, data);

      // Start polling for status
      if (data.data?.document?.id) {
        pollStatus(uploadFile.id, data.data.document.id);
      }
    } catch (error) {
      setFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : f
        )
      );

      onUploadError?.(uploadFile, error instanceof Error ? error : new Error('Upload failed'));
    }
  }, [endpoint, workspaceId, onUploadComplete, onUploadError]);

  // Poll for processing status
  const pollStatus = useCallback(async (fileId: string, documentId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${endpoint}?id=${documentId}`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        const status = data.data?.status;
        const progress = data.data?.progress || 0;

        setFiles(prev =>
          prev.map(f =>
            f.id === fileId
              ? {
                  ...f,
                  status: status === 'completed' ? 'completed' : status === 'failed' ? 'error' : 'processing',
                  progress: status === 'completed' ? 100 : 50 + (progress / 2),
                  error: data.data?.error,
                }
              : f
          )
        );

        // Continue polling if still processing
        if (status === 'processing' || status === 'pending') {
          setTimeout(poll, 2000);
        }
      } catch {
        // Retry on error
        setTimeout(poll, 5000);
      }
    };

    poll();
  }, [endpoint]);

  // Remove a file from the list
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Retry a failed upload
  const retryFile = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      uploadFile(file);
    }
  }, [files, uploadFile]);

  // Submit URL for scraping
  const submitUrl = useCallback(async (url: string) => {
    const uploadFile: UploadFile = {
      id: Math.random().toString(36).substr(2, 9),
      file: new (globalThis as typeof globalThis & { File: typeof File }).File([], url),
      name: new URL(url).hostname,
      size: 0,
      type: 'text/html',
      status: 'uploading',
      progress: 0,
    };

    setFiles(prev => [...prev, uploadFile]);

    try {
      const formData = new FormData();
      formData.append('url', url);
      if (workspaceId) {
        formData.append('workspaceId', workspaceId);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to queue URL');
      }

      const data = await response.json();

      setFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'processing',
                progress: 0,
                documentId: data.data?.document?.id,
              }
            : f
        )
      );

      // Start polling for status
      if (data.data?.document?.id) {
        pollStatus(uploadFile.id, data.data.document.id);
      }
    } catch (error) {
      setFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to scrape URL',
              }
            : f
        )
      );
    }
  }, [endpoint, workspaceId, pollStatus]);

  return {
    files,
    addFiles,
    removeFile,
    retryFile,
    submitUrl,
  };
}

export default UploadDropzone;
