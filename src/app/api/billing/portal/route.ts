/**
 * Billing Portal API
 *
 * POST /api/billing/portal - Create a billing portal session
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createBillingPortalSession, isStripeConfigured } from '@/lib/billing/stripe';
import { prisma } from '@/lib/db';

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
    const { returnUrl } = body;

    // Get user's subscription to find customer ID
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        stripeCustomerId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: { code: 'NO_CUSTOMER', message: 'No billing customer found' } },
        { status: 404 }
      );
    }

    const portalUrl = await createBillingPortalSession(
      subscription.stripeCustomerId,
      returnUrl || `${process.env.NEXTAUTH_URL}/settings/billing`
    );

    if (!portalUrl) {
      return NextResponse.json(
        { error: { code: 'PORTAL_ERROR', message: 'Failed to create portal session' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { url: portalUrl },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create portal session' } },
      { status: 500 }
    );
  }
}
