'use client';

import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, XCircle, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// =============================================================================
// Types
// =============================================================================

type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface IngestionJobRow {
  id: string;
  documentId: string;
  documentName: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  durationMs: number | null;
}

// =============================================================================
// Helpers
// =============================================================================

function getStatusIcon(status: JobStatus) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'PROCESSING':
      return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
    case 'QUEUED':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function getStatusBadge(status: JobStatus) {
  const variants: Record<JobStatus, { className: string; label: string }> = {
    COMPLETED: {
      className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      label: 'Completed',
    },
    PROCESSING: {
      className: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      label: 'Processing',
    },
    QUEUED: {
      className: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      label: 'Queued',
    },
    FAILED: {
      className: 'bg-red-500/10 border-red-500/20 text-red-400',
      label: 'Failed',
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

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getProgressColor(status: JobStatus): string {
  switch (status) {
    case 'FAILED':
      return 'bg-red-500';
    case 'COMPLETED':
      return 'bg-emerald-500';
    case 'PROCESSING':
      return 'bg-amber-500';
    default:
      return 'bg-blue-500';
  }
}

// =============================================================================
// Main Component
// =============================================================================

export default function AdminJobsPage(): React.ReactElement {
  const [jobs, setJobs] = useState<IngestionJobRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      // We use the internal Prisma-based API endpoint or directly fetch
      // from a lightweight admin endpoint. For now, we use the internal
      // /api/ingest status-checking pattern indirectly via an admin API.
      const res = await fetch(`/api/admin/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (_error: unknown) {
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  }, [statusFilter]);

  // Initial fetch and auto-refresh every 10 seconds
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Check if there are active jobs (to show auto-refresh indicator)
  const hasActiveJobs = jobs.some((job) => job.status === 'QUEUED' || job.status === 'PROCESSING');

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'QUEUED', label: 'Queued' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'FAILED', label: 'Failed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ingestion Jobs</h1>
          <p className="text-muted-foreground mt-2">Monitor document processing jobs</p>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveJobs && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Auto-refreshing...
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              fetchJobs();
            }}
            className="inline-flex items-center justify-center rounded-full bg-white/10 border border-white/10 px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/20 shadow-lg transition-all"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
        <CardHeader className="border-b border-border/40 pb-4 mb-4">
          <CardTitle className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            Job Queue
          </CardTitle>
          <CardDescription className="font-medium text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </CardDescription>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {filters.map((filter) => {
              const isActive = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setIsLoading(true);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <div className="mb-4 rounded-full bg-foreground/5 p-4 ring-1 ring-foreground/10">
                <Zap className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">No jobs found</p>
              {statusFilter !== 'all' && (
                <p className="text-xs mt-1">Try changing the status filter</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold">Document</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Progress</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Duration</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Created</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="border-border/20 hover:bg-white/5 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-primary/10 p-1.5 ring-1 ring-primary/20">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {job.documentName}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {job.documentId.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${getProgressColor(job.status)}`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{job.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(job.durationMs)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(job.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {job.error ? (
                        <span
                          className="text-xs text-red-400 truncate block max-w-[200px]"
                          title={job.error}
                        >
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          {job.error}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
