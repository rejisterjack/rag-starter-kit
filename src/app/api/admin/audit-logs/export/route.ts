import { NextResponse } from 'next/server';
import { exportAuditLogs } from '@/lib/audit/audit-logger';
import { requireAdmin } from '@/lib/auth';

// =============================================================================
// GET /api/admin/audit-logs/export
// Export audit logs for compliance/download
// =============================================================================

export async function GET(): Promise<Response> {
  try {
    // Verify admin access
    await requireAdmin();

    // Export last 90 days of logs
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const logs = await exportAuditLogs({ startDate });

    // Create JSON response with proper headers for download
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
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
