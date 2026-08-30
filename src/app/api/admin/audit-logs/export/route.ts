import { apiError } from '@/lib/api-response';
import { exportAuditLogs } from '@/lib/audit/audit-logger';
import { requireAdmin } from '@/lib/auth';

// =============================================================================
// GET /api/admin/audit-logs/export
// Export audit logs for compliance/download
// =============================================================================

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();

    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const logs = await exportAuditLogs({ startDate });

    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: 'application/json',
    });

    return new Response(blob, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to export audit logs', 500);
  }
}
