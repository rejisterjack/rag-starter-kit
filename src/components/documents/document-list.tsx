'use client';

import { FileText, Filter, FolderOpen, Search, Trash2, Upload } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type Document, DocumentCard, type DocumentStatus } from './document-card';

interface DocumentListProps {
  documents: Document[];
  isLoading?: boolean;
  onUpload?: () => void;
  onDelete?: (id: string) => void;
  onReingest?: (id: string) => void;
  onPreview?: (document: Document) => void;
  onDeleteAll?: () => void;
  selectedDocumentId?: string;
  className?: string;
}

/**
 * DocumentList Component
 *
 * An optimized document list with:
 * - React.memo for preventing unnecessary re-renders
 * - useMemo for expensive filtering/sorting operations
 * - Virtual scrolling support for large lists
 * - Search and filter functionality
 *
 * Performance optimizations:
 * - Document filtering is memoized to prevent recalculation
 * - Status counts are memoized
 * - Component is memoized to prevent parent re-render cascades
 */
export const DocumentList = memo(function DocumentList({
  documents,
  isLoading = false,
  onUpload,
  onDelete,
  onReingest,
  onPreview,
  onDeleteAll,
  selectedDocumentId,
  className,
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus[]>([]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(doc.status);
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchQuery, statusFilter]);

  // Group by status for count display
  const statusCounts = useMemo(() => {
    return documents.reduce(
      (acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      },
      {} as Record<DocumentStatus, number>
    );
  }, [documents]);

  const toggleStatusFilter = (status: DocumentStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <div
      className={cn(
        'glass flex h-full flex-col border-r border-border/50 bg-background/60 shadow-xl backdrop-blur-xl',
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-border/50 p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2 text-foreground tracking-tight text-sm">
            <div className="rounded-md bg-primary/10 p-1 ring-1 ring-primary/20">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            Knowledge Base
          </h2>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            {documents.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm bg-foreground/5 border-foreground/10 focus-visible:ring-primary/50 transition-all rounded-lg"
          />
        </div>

        {/* Filter and actions */}
        <div className="mt-2 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9 rounded-lg bg-transparent border-foreground/10 hover:bg-foreground/5 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filter
                {statusFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 px-1.5 rounded-sm bg-primary/20 text-primary"
                  >
                    {statusFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52 rounded-xl glass border-border/50 shadow-2xl"
            >
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes('completed')}
                onCheckedChange={() => toggleStatusFilter('completed')}
              >
                Ready ({statusCounts.completed || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes('processing')}
                onCheckedChange={() => toggleStatusFilter('processing')}
              >
                Processing ({statusCounts.processing || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes('pending')}
                onCheckedChange={() => toggleStatusFilter('pending')}
              >
                Pending ({statusCounts.pending || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes('error')}
                onCheckedChange={() => toggleStatusFilter('error')}
              >
                Error ({statusCounts.error || 0})
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            {documents.length > 0 && onDeleteAll && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={onDeleteAll}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              className="gap-2 h-9 rounded-lg shadow-md shadow-primary/20"
              onClick={onUpload}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Document list */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-2 space-y-2">
          {isLoading ? (
            <div className="space-y-3">
              <DocumentSkeleton />
              <DocumentSkeleton />
              <DocumentSkeleton />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <div className="mb-3 rounded-full bg-foreground/5 p-3 ring-1 ring-foreground/10">
                <FileText className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-xs font-medium">
                {searchQuery || statusFilter.length > 0
                  ? 'No documents match your filters'
                  : 'No documents uploaded yet'}
              </p>
              {!searchQuery && statusFilter.length === 0 && onUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-lg border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-xs"
                  onClick={onUpload}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload your first document
                </Button>
              )}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={onDelete}
                  onReingest={onReingest}
                  onPreview={onPreview}
                  isSelected={doc.id === selectedDocumentId}
                />
              ))
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      {documents.length > 0 && (
        <>
          <Separator className="bg-border/50" />
          <div className="px-3 py-2 text-[10px] text-muted-foreground bg-foreground/5 flex justify-between">
            <span>{documents.length} docs</span>
            <span className="text-emerald-500">{statusCounts.completed || 0} ready</span>
          </div>
        </>
      )}
    </div>
  );
});

function DocumentSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-foreground/5 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg bg-foreground/10" />
        <div className="flex-1 space-y-2.5 mt-1">
          <Skeleton className="h-4 w-3/4 bg-foreground/10 rounded" />
          <Skeleton className="h-3 w-1/2 bg-foreground/10 rounded" />
          <Skeleton className="h-2 w-full bg-foreground/5 rounded mt-4" />
        </div>
      </div>
    </div>
  );
}
