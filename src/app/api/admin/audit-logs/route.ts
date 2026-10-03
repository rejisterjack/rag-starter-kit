import { AuditEvent, AuditSeverity } from '@/generated/prisma/client';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getAuditLogs } from '@/lib/audit/audit-logger';
import { requireAdmin } from '@/lib/auth';

// =============================================================================
// GET /api/admin/audit-logs
// Get audit logs with optional filtering
// =============================================================================

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    const cursor = searchParams.get('cursor') ?? undefined;
    const event = searchParams.get('event') as AuditEvent | undefined;
    const severity = searchParams.get('severity') as AuditSeverity | undefined;
    const userId = searchParams.get('userId') ?? undefined;
    const workspaceId = searchParams.get('workspaceId') ?? undefined;

    const startDateParam = searchParams.get('startDate');
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDateParam = searchParams.get('endDate');
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const validEvent = event && Object.values(AuditEvent).includes(event) ? event : undefined;
    const validSeverity =
      severity && Object.values(AuditSeverity).includes(severity) ? severity : undefined;

    const result = await getAuditLogs({
      limit,
      offset: cursor ? undefined : offset,
      cursor,
      event: validEvent,
      severity: validSeverity,
      userId,
      workspaceId,
      startDate,
      endDate,
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to fetch audit logs', 500);
  }
}
