/**
 * Billing Plans API
 *
 * GET /api/billing/plans - List all available plans
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        priceMonth: true,
        priceYear: true,
        maxWorkspaces: true,
        maxDocuments: true,
        maxStorageBytes: true,
        maxMessages: true,
        maxApiCalls: true,
        features: true,
      },
    });

    // Format prices from cents to dollars
    const formattedPlans = plans.map((plan) => ({
      ...plan,
      priceMonth: plan.priceMonth / 100,
      priceYear: plan.priceYear / 100,
      maxStorageGB: Number(plan.maxStorageBytes) / (1024 * 1024 * 1024),
    }));

    return NextResponse.json({
      success: true,
      data: { plans: formattedPlans },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch billing plans', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch plans' } },
      { status: 500 }
    );
  }
}
