import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface VariantStats {
  variantId: string;
  variantName: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  uniqueUsers: number;
  uniqueSessions: number;
  customEvents: number;
}

interface ExperimentResults {
  experimentId: string;
  experimentName: string;
  status: string;
  totalEvents: number;
  totalImpressions: number;
  totalConversions: number;
  overallConversionRate: number;
  variants: VariantStats[];
  winner?: {
    variantId: string;
    variantName: string;
    confidence: number;
    improvement: number;
  };
}

/**
 * GET /api/experiments/[id]/results
 * Get experiment results and statistics
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const experiment = await prisma.experiment.findUnique({
      where: { id },
    });

    if (!experiment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Experiment not found' } },
        { status: 404 }
      );
    }

    // Check if user has access to workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: experiment.workspaceId,
        userId: session.user.id,
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get all events for this experiment
    const events = await prisma.experimentEvent.findMany({
      where: { experimentId: id },
    });

    // Calculate results
    const results = calculateExperimentResults({
      id: experiment.id,
      name: experiment.name,
      status: experiment.status,
      variants: experiment.variants,
      events,
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error: unknown) {
    logger.error('Failed to get experiment results', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get experiment results' } },
      { status: 500 }
    );
  }
}

/**
 * Calculate experiment results from events
 */
function calculateExperimentResults(experiment: {
  id: string;
  name: string;
  status: string;
  variants: unknown;
  events: Array<{
    id: string;
    variantId: string;
    eventType: string;
    userId: string | null;
    sessionId: string;
    createdAt: Date;
  }>;
}): ExperimentResults {
  const variants = experiment.variants as unknown as Array<{
    id: string;
    name: string;
    description?: string;
  }>;

  // Initialize stats for each variant
  const variantStatsMap = new Map<string, VariantStats>();

  for (const variant of variants) {
    variantStatsMap.set(variant.id, {
      variantId: variant.id,
      variantName: variant.name,
      impressions: 0,
      conversions: 0,
      conversionRate: 0,
      uniqueUsers: 0,
      uniqueSessions: 0,
      customEvents: 0,
    });
  }

  // Track unique users and sessions per variant
  const uniqueUsersPerVariant = new Map<string, Set<string>>();
  const uniqueSessionsPerVariant = new Map<string, Set<string>>();

  // Aggregate events
  for (const event of experiment.events) {
    const stats = variantStatsMap.get(event.variantId);
    if (!stats) continue;

    // Track unique users
    if (event.userId) {
      if (!uniqueUsersPerVariant.has(event.variantId)) {
        uniqueUsersPerVariant.set(event.variantId, new Set());
      }
      uniqueUsersPerVariant.get(event.variantId)?.add(event.userId);
    }

    // Track unique sessions
    if (!uniqueSessionsPerVariant.has(event.variantId)) {
      uniqueSessionsPerVariant.set(event.variantId, new Set());
    }
    uniqueSessionsPerVariant.get(event.variantId)?.add(event.sessionId);

    // Count event types
    switch (event.eventType) {
      case 'impression':
        stats.impressions++;
        break;
      case 'conversion':
        stats.conversions++;
        break;
      case 'custom':
        stats.customEvents++;
        break;
    }
  }

  // Update unique counts and calculate conversion rates
  for (const [variantId, stats] of variantStatsMap) {
    stats.uniqueUsers = uniqueUsersPerVariant.get(variantId)?.size ?? 0;
    stats.uniqueSessions = uniqueSessionsPerVariant.get(variantId)?.size ?? 0;

    // Calculate conversion rate based on impressions
    if (stats.impressions > 0) {
      stats.conversionRate = Number(((stats.conversions / stats.impressions) * 100).toFixed(2));
    }
  }

  // Convert map to array
  const variantStats = Array.from(variantStatsMap.values());

  // Calculate totals
  const totalEvents = experiment.events.length;
  const totalImpressions = variantStats.reduce((sum, v) => sum + v.impressions, 0);
  const totalConversions = variantStats.reduce((sum, v) => sum + v.conversions, 0);
  const overallConversionRate =
    totalImpressions > 0 ? Number(((totalConversions / totalImpressions) * 100).toFixed(2)) : 0;

  // Determine winner using statistical significance
  const winner = determineWinner(variantStats);

  return {
    experimentId: experiment.id,
    experimentName: experiment.name,
    status: experiment.status,
    totalEvents,
    totalImpressions,
    totalConversions,
    overallConversionRate,
    variants: variantStats,
    ...(winner && { winner }),
  };
}

/**
 * Determine the winning variant using statistical methods
 * Uses a simplified z-test for proportions
 */
function determineWinner(variantStats: VariantStats[]):
  | {
      variantId: string;
      variantName: string;
      confidence: number;
      improvement: number;
    }
  | undefined {
  if (variantStats.length < 2) return undefined;

  // Need minimum sample size
  const MIN_SAMPLE_SIZE = 30;
  const variantsWithData = variantStats.filter((v) => v.impressions >= MIN_SAMPLE_SIZE);

  if (variantsWithData.length < 2) return undefined;

  // Find the variant with highest conversion rate (control is typically first)
  const control = variantsWithData[0];
  let bestVariant = control;
  let bestRate = control.conversionRate;

  for (let i = 1; i < variantsWithData.length; i++) {
    const variant = variantsWithData[i];
    if (variant.conversionRate > bestRate) {
      bestRate = variant.conversionRate;
      bestVariant = variant;
    }
  }

  // If control is best, no winner
  if (bestVariant.variantId === control.variantId) return undefined;

  // Calculate z-score for proportions
  const p1 = bestVariant.conversions / bestVariant.impressions;
  const p2 = control.conversions / control.impressions;
  const n1 = bestVariant.impressions;
  const n2 = control.impressions;

  const pooledP = (bestVariant.conversions + control.conversions) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  if (se === 0) return undefined;

  const zScore = (p1 - p2) / se;

  // Convert z-score to confidence level (two-tailed)
  // z > 1.96 = 95% confidence, z > 2.58 = 99% confidence
  const confidence = Math.min(99, Math.max(0, (1 - 2 * (1 - normalCDF(Math.abs(zScore)))) * 100));

  // Only declare winner if confidence >= 95%
  if (confidence < 95) return undefined;

  // Calculate improvement percentage
  const improvement =
    control.conversionRate > 0
      ? Number(
          (
            ((bestVariant.conversionRate - control.conversionRate) / control.conversionRate) *
            100
          ).toFixed(2)
        )
      : bestVariant.conversionRate > 0
        ? 100
        : 0;

  return {
    variantId: bestVariant.variantId,
    variantName: bestVariant.variantName,
    confidence: Number(confidence.toFixed(2)),
    improvement,
  };
}

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(x: number): number {
  // Constants for approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1 + sign * y);
}
