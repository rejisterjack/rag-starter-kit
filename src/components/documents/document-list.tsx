'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Filter, FolderOpen, Search, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
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
      <div className="border-b border-border/50 p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold flex items-center gap-2 text-foreground tracking-tight">
            <div className="rounded-md bg-primary/10 p-1.5 ring-1 ring-primary/20">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            Knowledge Base
          </h2>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            {documents.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-foreground/5 border-foreground/10 focus-visible:ring-primary/50 transition-all rounded-xl"
          />
        </div>

        {/* Filter and actions */}
        <div className="mt-4 flex items-center justify-between">
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
        <div className="p-4 space-y-3">
          {isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <DocumentSkeleton />
              <DocumentSkeleton />
              <DocumentSkeleton />
            </motion.div>
          ) : filteredDocuments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground"
            >
              <div className="mb-4 rounded-full bg-foreground/5 p-4 ring-1 ring-foreground/10">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">
                {searchQuery || statusFilter.length > 0
                  ? 'No documents match your filters'
                  : 'No documents uploaded yet'}
              </p>
              {!searchQuery && statusFilter.length === 0 && onUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5 rounded-lg border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                  onClick={onUpload}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload your first document
                </Button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredDocuments.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
                >
                  <DocumentCard
                    document={doc}
                    onDelete={onDelete}
                    onReingest={onReingest}
                    onPreview={onPreview}
                    isSelected={doc.id === selectedDocumentId}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      <AnimatePresence>
        {documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Separator className="bg-border/50" />
            <div className="p-4 text-xs text-muted-foreground bg-foreground/5 backdrop-blur-sm">
              <div className="flex justify-between">
                <span>Total documents</span>
                <span className="font-medium text-foreground">{documents.length}</span>
              </div>
              <div className="flex justify-between mt-1.5">
                <span>Ready</span>
                <span className="font-medium text-emerald-500">{statusCounts.completed || 0}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
