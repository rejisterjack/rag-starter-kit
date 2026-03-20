import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getAuditLogs } from '@/lib/audit/audit-logger';
import { AuditEvent, AuditSeverity } from '@prisma/client';

// =============================================================================
// GET /api/admin/audit-logs
// Get audit logs with optional filtering
// =============================================================================

export async function GET(req: Request): Promise<Response> {
  try {
    // Verify admin access
    await requireAdmin();

    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    const event = searchParams.get('event') as AuditEvent | undefined;
    const severity = searchParams.get('severity') as AuditSeverity | undefined;
    const userId = searchParams.get('userId') ?? undefined;
    const workspaceId = searchParams.get('workspaceId') ?? undefined;

    // Parse date range
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    // Validate event type
    const validEvent = event && Object.values(AuditEvent).includes(event) ? event : undefined;
    const validSeverity =
      severity && Object.values(AuditSeverity).includes(severity) ? severity : undefined;

    const result = await getAuditLogs({
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      event: validEvent,
      severity: validSeverity,
      userId,
      workspaceId,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
