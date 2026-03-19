'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Filter, Download, AlertTriangle, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';

interface AuditLogEntry {
  id: string;
  event: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  userId?: string;
  userName?: string;
  workspaceId?: string;
  workspaceName?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  ipAddress?: string;
}

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  isLoading?: boolean;
  onExport?: () => void;
  className?: string;
}

const severityConfig = {
  INFO: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
  WARNING: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  ERROR: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
  CRITICAL: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
};

export function AuditLogViewer({
  logs,
  isLoading,
  onExport,
  className,
}: AuditLogViewerProps) {
  const [filter, setFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !filter ||
      log.event.toLowerCase().includes(filter.toLowerCase()) ||
      log.userName?.toLowerCase().includes(filter.toLowerCase()) ||
      JSON.stringify(log.metadata).toLowerCase().includes(filter.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesEvent = eventFilter === 'all' || log.event === eventFilter;

    return matchesSearch && matchesSeverity && matchesEvent;
  });

  const uniqueEvents = Array.from(new Set(logs.map((l) => l.event)));

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {uniqueEvents.map((event) => (
              <SelectItem key={event} value={event}>
                {event}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {/* Logs Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const config = severityConfig[log.severity];
                const Icon = config.icon;

                return (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell>
                      <div className={cn('flex items-center gap-2', config.color)}>
                        <Icon className="h-4 w-4" />
                        <Badge variant="outline" className={config.bg}>
                          {log.severity}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{log.event}</TableCell>
                    <TableCell>{log.userName || log.userId || 'System'}</TableCell>
                    <TableCell>{log.workspaceName || '-'}</TableCell>
                    <TableCell>{format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress || '-'}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Log Detail Modal would go here */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold">Audit Log Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogViewer;
