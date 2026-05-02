/**
 * Stripe Integration
 *
 * Handles all Stripe-related operations including:
 * - Customer management
 * - Subscription management
 * - Payment processing
 * - Webhook handling
 */

import Stripe from 'stripe';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// Initialize Stripe client
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    })
  : null;

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!stripe && !!env.STRIPE_SECRET_KEY;
}

/**
 * Create a Stripe customer
 */
export async function createCustomer(email: string, name?: string): Promise<string | null> {
  if (!stripe) return null;

  try {
    const customer = await stripe.customers.create({
      email,
      name,
    });
    return customer.id;
  } catch (error: unknown) {
    logger.error('Failed to create Stripe customer', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Create a subscription
 */
export async function createSubscription(
  customerId: string,
  priceId: string
): Promise<{
  subscriptionId: string;
  clientSecret: string | null;
}> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });

  const latestInvoice = subscription.latest_invoice as Stripe.Invoice & {
    payment_intent?: Stripe.PaymentIntent;
  };

  return {
    subscriptionId: subscription.id,
    clientSecret: latestInvoice?.payment_intent?.client_secret || null,
  };
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd = true
): Promise<boolean> {
  if (!stripe) return false;

  try {
    if (atPeriodEnd) {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(subscriptionId);
    }
    return true;
  } catch (error: unknown) {
    logger.error('Failed to cancel Stripe subscription', {
      subscriptionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error: unknown) {
    logger.error('Failed to retrieve Stripe subscription', {
      subscriptionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  } catch (error: unknown) {
    logger.error('Failed to create Stripe billing portal session', {
      customerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Construct webhook event
 */
export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Get publishable key
 */
export function getPublishableKey(): string | null {
  return env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}
