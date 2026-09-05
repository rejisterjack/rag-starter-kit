import { apiError } from '@/lib/api-response';
import { type AuditLogResult, exportAuditLogs } from '@/lib/audit/audit-logger';
import { requireAdmin } from '@/lib/auth';

// =============================================================================
// GET /api/admin/audit-logs/export
// Export audit logs for compliance/download as CSV
// =============================================================================

const CSV_COLUMNS = [
  'id',
  'createdAt',
  'event',
  'severity',
  'user',
  'userEmail',
  'workspaceId',
  'resource',
  'error',
  'metadata',
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'object'
      ? JSON.stringify(value)
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  // Wrap in quotes when the cell contains a delimiter, quote, or newline;
  // double any embedded quotes per RFC 4180
  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function toCsvRow(log: AuditLogResult): string[] {
  return [
    log.id,
    log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
    log.event,
    log.severity,
    log.user?.name ?? log.user?.id ?? '',
    log.user?.email ?? '',
    log.workspaceId ?? '',
    csvEscape(log.resource),
    log.error ?? '',
    csvEscape(log.metadata),
  ];
}

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();

    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const logs = await exportAuditLogs({ startDate });

    const lines = [CSV_COLUMNS.join(',')];
    for (const log of logs) {
      lines.push(toCsvRow(log).map(csvEscape).join(','));
    }
    // Prepend a UTF-8 BOM so spreadsheet apps decode the file correctly
    const csv = `\uFEFF${lines.join('\r\n')}`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to export audit logs', 500);
  }
}
