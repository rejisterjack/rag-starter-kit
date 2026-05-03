/**
 * Admin Cost Alerts API
 *
 * GET - View current cost anomalies
 */

import { type NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth';
import { detectCostAnomalies } from '@/lib/billing/cost-monitor';

export const GET = withApiAuth(async (_req: NextRequest, session) => {
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  const anomalies = await detectCostAnomalies();

  return NextResponse.json({
    success: true,
    data: {
      anomalies,
      count: anomalies.length,
    },
  });
});
