import { CheckCircle2, Clock, FileText, Loader2, Search, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { DeleteButton, ReingestButton } from '@/components/admin/documents/document-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface DocumentRow {
  id: string;
  name: string;
  contentType: string;
  size: number;
  status: DocumentStatus;
  workspaceName: string | null;
  createdAt: Date;
  chunkCount: number;
}

// =============================================================================
// Server Data
// =============================================================================

async function getAllDocuments(statusFilter?: string): Promise<DocumentRow[]> {
  const where =
    statusFilter && statusFilter !== 'all' ? { status: statusFilter as DocumentStatus } : {};

  const documents = await prisma.document.findMany({
    where,
    include: {
      workspace: {
        select: { name: true },
      },
      chunks: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    contentType: doc.contentType,
    size: doc.size,
    status: doc.status,
    workspaceName: doc.workspace?.name ?? null,
    createdAt: doc.createdAt,
    chunkCount: doc.chunks.length,
  }));
}

// =============================================================================
// Status Helpers
// =============================================================================

function getStatusIcon(status: DocumentStatus) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'PROCESSING':
      return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
    case 'PENDING':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function getStatusBadge(status: DocumentStatus) {
  const variants: Record<DocumentStatus, { className: string; label: string }> = {
    COMPLETED: {
      className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      label: 'Ready',
    },
    PROCESSING: {
      className: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      label: 'Processing',
    },
    PENDING: {
      className: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      label: 'Pending',
    },
    FAILED: {
      className: 'bg-red-500/10 border-red-500/20 text-red-400',
      label: 'Error',
    },
  };

  const v = variants[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${v.className}`}
    >
      {getStatusIcon(status)}
      {v.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================================================
// Document Table Content (server component)
// =============================================================================

async function DocumentsTable({ status }: { status?: string }) {
  const documents = await getAllDocuments(status);

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <div className="mb-4 rounded-full bg-foreground/5 p-4 ring-1 ring-foreground/10">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium">No documents found</p>
        {status && status !== 'all' && (
          <p className="text-xs mt-1">Try changing the status filter</p>
        )}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/40 hover:bg-transparent">
          <TableHead className="text-muted-foreground font-semibold">Document</TableHead>
          <TableHead className="text-muted-foreground font-semibold">Workspace</TableHead>
          <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
          <TableHead className="text-muted-foreground font-semibold">Size</TableHead>
          <TableHead className="text-muted-foreground font-semibold">Chunks</TableHead>
          <TableHead className="text-muted-foreground font-semibold">Date</TableHead>
          <TableHead className="text-muted-foreground font-semibold text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id} className="border-border/20 hover:bg-white/5 transition-colors">
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-1.5 ring-1 ring-primary/20">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-[250px]">
                    {doc.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{doc.contentType}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {doc.workspaceName || 'Personal'}
              </span>
            </TableCell>
            <TableCell>{getStatusBadge(doc.status)}</TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">{formatBytes(doc.size)}</span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">{doc.chunkCount}</span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">{formatDate(doc.createdAt)}</span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                {doc.status === 'FAILED' && <ReingestButton documentId={doc.id} />}
                <DeleteButton documentId={doc.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// =============================================================================
// Filter Bar
// =============================================================================

function FilterBar({ currentStatus }: { currentStatus?: string }) {
  const filters = [
    { value: 'all', label: 'All' },
    { value: 'COMPLETED', label: 'Ready' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'FAILED', label: 'Error' },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => {
        const isActive = (currentStatus || 'all') === filter.value;
        const href =
          filter.value === 'all' ? '/admin/documents' : `/admin/documents?status=${filter.value}`;

        return (
          <Link
            key={filter.value}
            href={href}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10'
            }`}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminDocumentsPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const statusFilter = params.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-2">Manage all documents across workspaces</p>
        </div>
        <Link
          href="/admin/documents"
          className="inline-flex items-center justify-center rounded-full bg-white/10 border border-white/10 px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/20 shadow-lg transition-all"
        >
          <Search className="h-4 w-4 mr-2" />
          Refresh
        </Link>
      </div>

      <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
        <CardHeader className="border-b border-border/40 pb-4 mb-4">
          <CardTitle className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            All Documents
          </CardTitle>
          <CardDescription className="font-medium text-muted-foreground">
            Showing documents across all workspaces
          </CardDescription>
          <div className="mt-4">
            <FilterBar currentStatus={statusFilter} />
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <DocumentsTable status={statusFilter} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
