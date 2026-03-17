"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Upload,
  FileText,
  Filter,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCard, type Document, type DocumentStatus } from "./document-card";

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

export function DocumentList({
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus[]>([]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(doc.status);
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
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Documents
          </h2>
          <Badge variant="secondary">{documents.length}</Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter and actions */}
        <div className="mt-3 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
                {statusFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {statusFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes("completed")}
                onCheckedChange={() => toggleStatusFilter("completed")}
              >
                Ready ({statusCounts.completed || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes("processing")}
                onCheckedChange={() => toggleStatusFilter("processing")}
              >
                Processing ({statusCounts.processing || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes("pending")}
                onCheckedChange={() => toggleStatusFilter("pending")}
              >
                Pending ({statusCounts.pending || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter.includes("error")}
                onCheckedChange={() => toggleStatusFilter("error")}
              >
                Error ({statusCounts.error || 0})
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            {documents.length > 0 && onDeleteAll && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDeleteAll}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" className="gap-2" onClick={onUpload}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Document list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            // Loading skeletons
            <>
              <DocumentSkeleton />
              <DocumentSkeleton />
              <DocumentSkeleton />
            </>
          ) : filteredDocuments.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FileText className="mb-4 h-12 w-12 opacity-20" />
              <p className="text-sm">
                {searchQuery || statusFilter.length > 0
                  ? "No documents match your filters"
                  : "No documents uploaded yet"}
              </p>
              {!searchQuery && statusFilter.length === 0 && onUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={onUpload}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload your first document
                </Button>
              )}
            </div>
          ) : (
            // Document cards
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
          <Separator />
          <div className="p-4 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Total documents</span>
              <span className="font-medium">{documents.length}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Ready</span>
              <span className="font-medium text-green-600">
                {statusCounts.completed || 0}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2 w-full" />
        </div>
      </div>
    </div>
  );
}
