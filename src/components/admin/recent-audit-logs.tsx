'use client';

import type { AuditEvent, AuditSeverity } from '@prisma/client';
import { motion, type Variants } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { AuditLogResult } from '@/lib/audit/audit-logger';

interface RecentAuditLogsProps {
  logs: AuditLogResult[];
}

function getSeverityColor(
  severity: AuditSeverity
): 'destructive' | 'warning' | 'secondary' | 'info' {
  switch (severity) {
    case 'CRITICAL':
    case 'ERROR':
      return 'destructive';
    case 'WARNING':
      return 'warning';
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 100 } },
};

export function RecentAuditLogs({ logs }: RecentAuditLogsProps): React.ReactElement {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground/60 font-medium">
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
      {logs.map((log) => (
        <motion.div
          variants={itemVariants}
          key={log.id}
          className="flex items-start gap-4 p-4 rounded-xl glass border border-white/5 hover:bg-white/5 transition-all duration-300"
        >
          <div className="text-2xl shrink-0 h-10 w-10 flex items-center justify-center bg-background/50 rounded-full shadow-inner">
            {getEventIcon(log.event)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm tracking-tight text-foreground/90">
                {log.event}
              </span>
              <Badge
                variant={getSeverityColor(log.severity)}
                className="text-[10px] uppercase font-bold tracking-wider px-2 py-0 border-none shadow-sm"
              >
                {log.severity}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/80">
              {log.user ? <span className="truncate">{log.user.email}</span> : <span>System</span>}
              <span className="opacity-50">•</span>
              <span>{formatRelativeTime(log.createdAt)}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
