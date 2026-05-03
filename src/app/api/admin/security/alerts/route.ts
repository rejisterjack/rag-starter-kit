/**
 * Admin Security Alerts API
 *
 * GET - View recent anomaly alerts from audit logs
 */

import { type NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth';
import { prismaRead } from '@/lib/db';

export const GET = withApiAuth(async (req: NextRequest, session) => {
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const hours = Number.parseInt(searchParams.get('hours') ?? '24', 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const alerts = await prismaRead.auditLog.findMany({
    where: {
      event: 'SUSPICIOUS_ACTIVITY',
      severity: { in: ['WARNING', 'CRITICAL'] },
      createdAt: { gte: since },
      metadata: { path: ['activity'], string_starts_with: 'anomaly:' },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({
    success: true,
    data: {
      alerts,
      count: alerts.length,
      period: `${hours}h`,
    },
  });
});
