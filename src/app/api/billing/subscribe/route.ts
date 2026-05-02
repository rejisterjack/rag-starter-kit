/**
 * Subscription API
 *
 * POST /api/billing/subscribe - Create a new subscription
 * GET /api/billing/subscribe - Get current subscription
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCustomer, createSubscription, isStripeConfigured } from '@/lib/billing/stripe';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/billing/subscribe
 * Get current user's subscription
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: {
        plan: true,
        usage: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // Return free plan as default
      const freePlan = await prisma.plan.findUnique({
        where: { name: 'free' },
      });

      return NextResponse.json({
        success: true,
        data: {
          subscription: null,
          plan: freePlan,
          usage: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
        plan: subscription.plan,
        usage: subscription.usage,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to get subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get subscription' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/subscribe
 * Create a new subscription
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Billing is not configured' } },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { planId, workspaceId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PLAN', message: 'Plan ID is required' } },
        { status: 400 }
      );
    }

    // Get plan details
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' } },
        { status: 404 }
      );
    }

    // Check if it's a free plan
    if (plan.priceMonth === 0 && plan.priceYear === 0) {
      // Create subscription without Stripe
      const subscription = await prisma.subscription.create({
        data: {
          userId: session.user.id,
          planId: plan.id,
          workspaceId: workspaceId || null,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years
        },
      });

      return NextResponse.json({
        success: true,
        data: { subscription },
      });
    }

    // Get or create Stripe customer
    let customerId: string | null = null;

    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        stripeCustomerId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
    } else {
      customerId = await createCustomer(session.user.email || '', session.user.name || undefined);
    }

    if (!customerId) {
      return NextResponse.json(
        { error: { code: 'CUSTOMER_ERROR', message: 'Failed to create customer' } },
        { status: 500 }
      );
    }

    // Create Stripe subscription
    const priceId = plan.stripePriceMonthId;
    if (!priceId) {
      return NextResponse.json(
        { error: { code: 'PRICE_NOT_FOUND', message: 'Plan price not configured' } },
        { status: 500 }
      );
    }

    const { subscriptionId, clientSecret } = await createSubscription(customerId, priceId);

    // Create local subscription record
    const subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id,
        planId: plan.id,
        workspaceId: workspaceId || null,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          clientSecret,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to create subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create subscription' } },
      { status: 500 }
    );
  }
}
