/**
 * Cron Cleanup Route
 *
 * POST /api/cron/cleanup
 *
 * Lightweight cleanup job triggered by Vercel Cron (or external scheduler).
 * Runs the same cleanup logic as the Inngest nightlyDbCleanupJob.
 * This serves as a fallback when Inngest is not configured.
 *
 * Secured with CRON_SECRET — Vercel sends this header automatically.
 */

import { NextResponse } from 'next/server';

export async function POST(req: Request): Promise<Response> {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, number> = {};
  const rateLimitRetentionDays = Number(process.env.RATE_LIMIT_RETENTION_DAYS ?? '7');
  const auditLogRetentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? '90');

  try {
    const { prisma } = await import('@/lib/db/client');

    // 1. Delete expired rate limit windows
    const rateLimitCutoff = new Date(Date.now() - rateLimitRetentionDays * 24 * 60 * 60 * 1000);
    const rl = await prisma.rateLimit.deleteMany({
      where: { windowStart: { lt: rateLimitCutoff } },
    });
    results.rateLimitsDeleted = rl.count;

    // 2. Delete old audit log entries
    const auditLogCutoff = new Date(Date.now() - auditLogRetentionDays * 24 * 60 * 60 * 1000);
    const al = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditLogCutoff } },
    });
    results.auditLogsDeleted = al.count;

    // 3. Delete expired verification tokens
    const vt = await prisma.verificationToken.deleteMany({
      where: { expires: { lt: new Date() } },
    });
    results.verificationTokensDeleted = vt.count;

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
      },
      { status: 500 }
    );
  }
}
