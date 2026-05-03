/**
 * Anomaly Detector
 *
 * Rule-based detection of suspicious patterns in recent audit events.
 * Runs on a scheduled basis and emits alerts when anomalies are found.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface AnomalyAlert {
  type: string;
  severity: 'WARNING' | 'CRITICAL';
  description: string;
  userId?: string;
  workspaceId?: string;
  metadata: Record<string, unknown>;
  detectedAt: Date;
}

/**
 * Detect multiple failed login attempts from different IPs for the same account.
 */
async function detectBruteForce(): Promise<AnomalyAlert[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const alerts: AnomalyAlert[] = [];

  const failedLogins = await prisma.auditLog.findMany({
    where: {
      event: 'SUSPICIOUS_ACTIVITY',
      createdAt: { gte: oneHourAgo },
      metadata: { path: ['activity'], equals: 'login_blocked_due_to_lockout' },
    },
    select: { userId: true, ipAddress: true, createdAt: true },
  });

  const attemptsByUser = new Map<string, Set<string>>();
  for (const log of failedLogins) {
    if (!log.userId) continue;
    const ips = attemptsByUser.get(log.userId) ?? new Set();
    ips.add(log.ipAddress ?? 'unknown');
    attemptsByUser.set(log.userId, ips);
  }

  for (const [userId, ips] of attemptsByUser) {
    if (ips.size >= 3) {
      alerts.push({
        type: 'brute_force',
        severity: 'CRITICAL',
        description: `Account ${userId} targeted from ${ips.size} different IPs in the last hour`,
        userId,
        metadata: { ipCount: ips.size, ips: Array.from(ips) },
        detectedAt: new Date(),
      });
    }
  }

  return alerts;
}

/**
 * Detect sudden spike in API usage (10x baseline in 1 hour).
 */
async function detectApiUsageSpike(): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const currentHour = await prisma.apiUsage.count({
    where: { createdAt: { gte: oneHourAgo } },
  });

  const last24h = await prisma.apiUsage.count({
    where: { createdAt: { gte: oneDayAgo } },
  });

  const hourlyBaseline = last24h > 0 ? last24h / 24 : 1;

  if (currentHour > hourlyBaseline * 10 && currentHour > 100) {
    alerts.push({
      type: 'api_usage_spike',
      severity: 'WARNING',
      description: `API usage spike: ${currentHour} requests in the last hour vs ${Math.round(hourlyBaseline)} average`,
      metadata: {
        currentHour,
        hourlyBaseline: Math.round(hourlyBaseline),
        multiplier: Math.round(currentHour / hourlyBaseline),
      },
      detectedAt: new Date(),
    });
  }

  return alerts;
}

/**
 * Detect API key usage from new IPs.
 */
async function detectApiKeyAnomalies(): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const suspiciousKeyActivity = await prisma.auditLog.findMany({
    where: {
      event: 'SUSPICIOUS_ACTIVITY',
      createdAt: { gte: oneHourAgo },
      OR: [
        { metadata: { path: ['activity'], equals: 'api_key_ip_restriction_violation' } },
        { metadata: { path: ['activity'], equals: 'api_key_hash_mismatch' } },
        { metadata: { path: ['activity'], equals: 'invalid_api_key_attempt' } },
      ],
    },
    select: { userId: true, workspaceId: true, metadata: true, createdAt: true },
    take: 50,
  });

  if (suspiciousKeyActivity.length >= 5) {
    alerts.push({
      type: 'api_key_abuse',
      severity: 'CRITICAL',
      description: `${suspiciousKeyActivity.length} suspicious API key activities in the last hour`,
      metadata: { count: suspiciousKeyActivity.length },
      detectedAt: new Date(),
    });
  }

  return alerts;
}

/**
 * Run all anomaly detection rules.
 */
export async function detectAnomalies(): Promise<AnomalyAlert[]> {
  try {
    const results = await Promise.all([
      detectBruteForce(),
      detectApiUsageSpike(),
      detectApiKeyAnomalies(),
    ]);

    const allAlerts = results.flat();
    if (allAlerts.length > 0) {
      logger.warn('Anomaly detection found issues', { count: allAlerts.length });
    }
    return allAlerts;
  } catch (error) {
    logger.error('Anomaly detection failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return [];
  }
}
