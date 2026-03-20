import type { AuditLogResult } from '@/lib/audit/audit-logger';
import { Badge } from '@/components/ui/badge';
import { AuditEvent, AuditSeverity } from '@prisma/client';

interface RecentAuditLogsProps {
  logs: AuditLogResult[];
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

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function RecentAuditLogs({ logs }: RecentAuditLogsProps): React.ReactElement {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <span className="text-lg shrink-0">{getEventIcon(log.event)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{log.event}</span>
              <Badge variant={getSeverityColor(log.severity)} className="text-xs">
                {log.severity}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {log.user ? <span className="truncate">{log.user.email}</span> : <span>System</span>}
              <span>•</span>
              <span>{formatRelativeTime(log.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
