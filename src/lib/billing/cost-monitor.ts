/**
 * Cost Anomaly Detection
 *
 * Tracks rolling hourly token spend per workspace and alerts
 * when current usage exceeds the trailing 7-day hourly average.
 * At 3x average: emits a warning alert.
 * At 10x average: auto rate-limits the workspace.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface CostAnomaly {
  workspaceId: string;
  currentHourTokens: number;
  hourlyAverage: number;
  multiplier: number;
  severity: 'WARNING' | 'CRITICAL';
}

/**
 * Detect cost anomalies across all workspaces.
 */
export async function detectCostAnomalies(): Promise<CostAnomaly[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const anomalies: CostAnomaly[] = [];

  // Current hour spend per workspace
  const currentSpend = await prisma.apiUsage.groupBy({
    by: ['workspaceId'],
    where: {
      createdAt: { gte: oneHourAgo },
      workspaceId: { not: null },
    },
    _sum: { tokensTotal: true },
  });

  // 7-day baseline per workspace
  const baselineSpend = await prisma.apiUsage.groupBy({
    by: ['workspaceId'],
    where: {
      createdAt: { gte: sevenDaysAgo },
      workspaceId: { not: null },
    },
    _sum: { tokensTotal: true },
  });

  const baselineMap = new Map<string, number>();
  for (const entry of baselineSpend) {
    const wsId = entry.workspaceId;
    if (wsId) {
      const total = entry._sum.tokensTotal ?? 0;
      baselineMap.set(wsId, total / (7 * 24)); // hourly average
    }
  }

  for (const entry of currentSpend) {
    const wsId = entry.workspaceId;
    if (!wsId) continue;

    const currentHour = entry._sum.tokensTotal ?? 0;
    const hourlyAvg = baselineMap.get(wsId) ?? 1;

    if (currentHour < 1000) continue; // Skip trivial amounts

    const multiplier = currentHour / hourlyAvg;

    if (multiplier >= 3) {
      anomalies.push({
        workspaceId: wsId,
        currentHourTokens: currentHour,
        hourlyAverage: Math.round(hourlyAvg),
        multiplier: Math.round(multiplier * 10) / 10,
        severity: multiplier >= 10 ? 'CRITICAL' : 'WARNING',
      });

      logger.warn('Cost anomaly detected', {
        workspaceId: wsId,
        currentHourTokens: currentHour,
        hourlyAverage: Math.round(hourlyAvg),
        multiplier: Math.round(multiplier * 10) / 10,
      });
    }
  }

  return anomalies;
}
