/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 */

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { constructWebhookEvent, stripe } from '@/lib/billing/stripe';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const payload = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(payload, signature);
    } catch (_err) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        // event.data.object is the checkout session
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;

        // Update subscription status
        const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string }).subscription;
        if (subscriptionId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: 'ACTIVE' },
          });
        }

        // Create invoice record
        if (invoice.customer) {
          const subscription = await prisma.subscription.findFirst({
            where: { stripeCustomerId: invoice.customer as string },
          });

          if (subscription) {
            await prisma.invoice.create({
              data: {
                userId: subscription.userId,
                subscriptionId: subscription.id,
                stripeInvoiceId: invoice.id,
                stripePaymentIntentId:
                  (invoice as Stripe.Invoice & { payment_intent?: string | null }).payment_intent ??
                  null,
                amount: invoice.amount_due,
                currency: invoice.currency,
                status: 'PAID',
                paidAt: new Date(),
                periodStart: new Date(invoice.period_start * 1000),
                periodEnd: new Date(invoice.period_end * 1000),
                pdfUrl: invoice.invoice_pdf,
              },
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string }).subscription;
        if (subscriptionId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: 'PAST_DUE' },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        type StripeSubExtended = Stripe.Subscription & {
          current_period_start?: number;
          current_period_end?: number;
          cancel_at_period_end?: boolean;
        };
        const sub = subscription as StripeSubExtended;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status.toUpperCase() as
              | 'ACTIVE'
              | 'CANCELED'
              | 'PAST_DUE'
              | 'UNPAID'
              | 'TRIALING',
            currentPeriodStart: sub.current_period_start
              ? new Date(sub.current_period_start * 1000)
              : new Date(),
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : new Date(),
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'CANCELED',
            cancelAtPeriodEnd: false,
          },
        });
        break;
      }

      default:
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    logger.error('Stripe webhook processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
