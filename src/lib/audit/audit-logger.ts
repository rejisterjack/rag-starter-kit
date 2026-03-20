import { AuditEvent, AuditSeverity, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// Re-export enums for convenience
export { AuditEvent, AuditSeverity };

// =============================================================================
// Types
// =============================================================================

export interface LogAuditEventInput {
  event: AuditEvent;
  userId?: string;
  workspaceId?: string;
  apiKeyId?: string;
  metadata?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  error?: string;
  severity?: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  workspaceId?: string;
  userId?: string;
  event?: AuditEvent;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  id: string;
  event: AuditEvent;
  severity: AuditSeverity;
  createdAt: Date;
  userId: string | null;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  resource: Record<string, unknown> | null;
  error: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// =============================================================================
// Audit Logger
// =============================================================================

/**
 * Log an audit event
 * This function is designed to be non-blocking and handle errors gracefully
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    // Don't block on audit logging
    prisma.auditLog
      .create({
        data: {
          event: input.event,
          userId: input.userId,
          workspaceId: input.workspaceId,
          severity: input.severity ?? 'INFO',
          metadata: (input.metadata ?? {}) as unknown as Prisma.InputJsonValue,
          resource: (input.resource ?? {}) as unknown as Prisma.InputJsonValue,
          changes: (input.changes ?? {}) as unknown as Prisma.InputJsonValue,
          error: input.error ?? null,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      })
      .catch((error) => {
        // Log to console if database logging fails
        console.error('Failed to write audit log:', error);
      });
  } catch (error) {
    // Never throw from audit logging
    console.error('Audit logging error:', error);
  }
}

/**
 * Log audit event with request context
 */
export async function logAuditEventFromRequest(
  req: Request,
  input: Omit<LogAuditEventInput, 'ipAddress' | 'userAgent'>
): Promise<void> {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || undefined;

  await logAuditEvent({
    ...input,
    ipAddress,
    userAgent,
  });
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(
  query: AuditLogQuery
): Promise<{ logs: AuditLogResult[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (query.workspaceId) {
    where.workspaceId = query.workspaceId;
  }

  if (query.userId) {
    where.userId = query.userId;
  }

  if (query.event) {
    where.event = query.event;
  }

  if (query.severity) {
    where.severity = query.severity;
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) {
      (where.createdAt as Record<string, Date>).gte = query.startDate;
    }
    if (query.endDate) {
      (where.createdAt as Record<string, Date>).lte = query.endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      metadata: log.metadata as Record<string, unknown> | null,
      resource: log.resource as Record<string, unknown> | null,
      changes: log.changes as Record<string, unknown> | null,
      error: log.error,
    })) as AuditLogResult[],
    total,
  };
}

/**
 * Get recent audit events for a workspace
 */
export async function getRecentWorkspaceEvents(
  workspaceId: string,
  limit = 20
): Promise<AuditLogResult[]> {
  const logs = await prisma.auditLog.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return logs.map((log) => ({
    ...log,
    metadata: log.metadata as Record<string, unknown> | null,
    resource: log.resource as Record<string, unknown> | null,
    changes: log.changes as Record<string, unknown> | null,
    error: log.error,
  })) as AuditLogResult[];
}

/**
 * Get security events (for admin/security monitoring)
 */
export async function getSecurityEvents(options?: {
  startDate?: Date;
  endDate?: Date;
  severity?: AuditSeverity;
  limit?: number;
}): Promise<AuditLogResult[]> {
  const where: Record<string, unknown> = {
    event: {
      in: [
        AuditEvent.SUSPICIOUS_ACTIVITY,
        AuditEvent.PERMISSION_DENIED,
        AuditEvent.RATE_LIMIT_HIT,
        AuditEvent.API_KEY_REVOKED,
      ],
    },
  };

  if (options?.severity) {
    where.severity = options.severity;
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      (where.createdAt as Record<string, Date>).gte = options.startDate;
    }
    if (options.endDate) {
      (where.createdAt as Record<string, Date>).lte = options.endDate;
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
  });

  return logs.map((log) => ({
    ...log,
    metadata: log.metadata as Record<string, unknown> | null,
    resource: log.resource as Record<string, unknown> | null,
    changes: log.changes as Record<string, unknown> | null,
    error: log.error,
  })) as AuditLogResult[];
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(
  userId: string,
  days = 30
): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  recentEvents: AuditLogResult[];
}> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalEvents, logs] = await Promise.all([
    prisma.auditLog.count({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  // Count events by type
  const eventsByType: Record<string, number> = {};
  logs.forEach((log) => {
    eventsByType[log.event] = (eventsByType[log.event] || 0) + 1;
  });

  return {
    totalEvents,
    eventsByType,
    recentEvents: logs as AuditLogResult[],
  };
}

// =============================================================================
// Cleanup Functions
// =============================================================================

/**
 * Clean up old audit logs
 * Retains security events longer than regular events
 */
export async function cleanupAuditLogs(): Promise<{
  deleted: number;
  retained: number;
}> {
  const regularRetention = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
  const securityRetention = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year

  // Delete regular logs older than 90 days
  const regularResult = await prisma.auditLog.deleteMany({
    where: {
      severity: { in: ['INFO', 'WARNING'] },
      createdAt: { lt: regularRetention },
    },
  });

  // Delete error/critical logs older than 1 year
  const securityResult = await prisma.auditLog.deleteMany({
    where: {
      severity: { in: ['ERROR', 'CRITICAL'] },
      createdAt: { lt: securityRetention },
    },
  });

  const remaining = await prisma.auditLog.count();

  return {
    deleted: regularResult.count + securityResult.count,
    retained: remaining,
  };
}

// =============================================================================
// Export/Archive Functions
// =============================================================================

/**
 * Export audit logs for compliance
 */
export async function exportAuditLogs(query: AuditLogQuery): Promise<AuditLogResult[]> {
  const { logs } = await getAuditLogs({ ...query, limit: 10000 });
  return logs;
}

/**
 * Get audit statistics
 */
export async function getAuditStats(
  workspaceId?: string,
  days = 30
): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  uniqueUsers: number;
}> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    createdAt: { gte: startDate },
  };

  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  const [totalEvents, logs, uniqueUsers] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: {
        event: true,
        severity: true,
      },
    }),
    prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        ...where,
        userId: { not: null },
      },
    }),
  ]);

  const eventsByType: Record<string, number> = {};
  const eventsBySeverity: Record<string, number> = {};

  logs.forEach((log) => {
    eventsByType[log.event] = (eventsByType[log.event] || 0) + 1;
    eventsBySeverity[log.severity] = (eventsBySeverity[log.severity] || 0) + 1;
  });

  return {
    totalEvents,
    eventsByType,
    eventsBySeverity,
    uniqueUsers: uniqueUsers.length,
  };
}
