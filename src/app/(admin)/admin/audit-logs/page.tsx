'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Filter, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditLogResult } from '@/lib/audit/audit-logger';
import { AuditEvent, AuditSeverity } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

interface AuditLogsResponse {
  logs: AuditLogResult[];
  total: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

function getSeverityColor(
  severity: AuditSeverity
): 'destructive' | 'warning' | 'secondary' | 'info' {
  switch (severity) {
    case 'CRITICAL':
      return 'destructive';
    case 'ERROR':
      return 'destructive';
    case 'WARNING':
      return 'warning';
    case 'INFO':
    default:
      return 'secondary';
  }
}

function getEventIcon(event: AuditEvent): string {
  const iconMap: Record<string, string> = {
    USER_LOGIN: '🔑',
    USER_LOGOUT: '👋',
    USER_REGISTERED: '📝',
    WORKSPACE_CREATED: '🏢',
    WORKSPACE_UPDATED: '✏️',
    DOCUMENT_UPLOADED: '📄',
    DOCUMENT_DELETED: '🗑️',
    API_KEY_CREATED: '🔐',
    API_KEY_REVOKED: '🚫',
    SUSPICIOUS_ACTIVITY: '⚠️',
    PERMISSION_DENIED: '🔒',
  };
  return iconMap[event] || '📋';
}

// =============================================================================
// Audit Logs Page Component
// =============================================================================

export default function AuditLogsPage(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLogResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [eventFilter, setEventFilter] = useState<AuditEvent | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | 'ALL'>('ALL');

  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((page - 1) * limit),
      });

      if (eventFilter !== 'ALL') {
        params.append('event', eventFilter);
      }
      if (severityFilter !== 'ALL') {
        params.append('severity', severityFilter);
      }

      const response = await fetch(`/api/admin/audit-logs?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data: AuditLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter, severityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/audit-logs/export');
      if (!response.ok) throw new Error('Failed to export logs');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-2">View and filter system audit events</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="w-full sm:w-auto">
            <label className="text-sm font-medium mb-2 block">Event Type</label>
            <Select
              value={eventFilter}
              onValueChange={(value) => {
                setEventFilter(value as AuditEvent | 'ALL');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Events</SelectItem>
                {Object.values(AuditEvent).map((event) => (
                  <SelectItem key={event} value={event}>
                    {event}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="text-sm font-medium mb-2 block">Severity</label>
            <Select
              value={severityFilter}
              onValueChange={(value) => {
                setSeverityFilter(value as AuditSeverity | 'ALL');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Severities</SelectItem>
                {Object.values(AuditSeverity).map((severity) => (
                  <SelectItem key={severity} value={severity}>
                    {severity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>
            Showing {logs.length} of {total} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchLogs}>
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="hidden md:table-cell">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{getEventIcon(log.event)}</TableCell>
                          <TableCell className="font-medium">{log.event}</TableCell>
                          <TableCell>
                            {log.user ? (
                              <div className="flex flex-col">
                                <span className="text-sm">{log.user.name || 'Unknown'}</span>
                                <span className="text-xs text-muted-foreground">
                                  {log.user.email}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">System</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getSeverityColor(log.severity)}>{log.severity}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {log.metadata && Object.keys(log.metadata).length > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {JSON.stringify(log.metadata).slice(0, 50)}
                                {JSON.stringify(log.metadata).length > 50 ? '...' : ''}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
