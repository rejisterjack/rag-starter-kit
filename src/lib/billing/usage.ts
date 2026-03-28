/**
 * Usage Tracking & Limits
 *
 * Tracks usage against plan limits and enforces restrictions
 */

import { prisma } from '@/lib/db';

export interface UsageCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt?: Date;
}

/**
 * Check if user has available document slots
 */
export async function checkDocumentLimit(userId: string): Promise<UsageCheck> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: {
      plan: true,
      usage: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const plan = subscription?.plan;
  const usage = subscription?.usage;

  if (!plan) {
    // No subscription found - use free plan defaults
    return {
      allowed: false,
      current: 0,
      limit: 10,
      remaining: 0,
    };
  }

  const current = usage?.documentsUsed || 0;
  const limit = plan.maxDocuments;
  const remaining = Math.max(0, limit - current);

  return {
    allowed: current < limit,
    current,
    limit,
    remaining,
    resetAt: subscription.currentPeriodEnd,
  };
}

/**
 * Check workspace limit
 */
export async function checkWorkspaceLimit(userId: string): Promise<UsageCheck> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: {
      plan: true,
      usage: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const plan = subscription?.plan;
  const usage = subscription?.usage;

  if (!plan) {
    return {
      allowed: false,
      current: 0,
      limit: 1,
      remaining: 0,
    };
  }

  const current = usage?.workspacesUsed || 0;
  const limit = plan.maxWorkspaces;
  const remaining = Math.max(0, limit - current);

  return {
    allowed: current < limit,
    current,
    limit,
    remaining,
    resetAt: subscription.currentPeriodEnd,
  };
}

/**
 * Check message/quota limit
 */
export async function checkMessageLimit(userId: string): Promise<UsageCheck> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: {
      plan: true,
      usage: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const plan = subscription?.plan;
  const usage = subscription?.usage;

  if (!plan) {
    return {
      allowed: false,
      current: 0,
      limit: 100,
      remaining: 0,
    };
  }

  const current = usage?.messagesUsed || 0;
  const limit = plan.maxMessages;
  const remaining = Math.max(0, limit - current);

  return {
    allowed: current < limit,
    current,
    limit,
    remaining,
    resetAt: subscription.currentPeriodEnd,
  };
}

/**
 * Increment document usage
 */
export async function incrementDocumentUsage(userId: string, count = 1): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: { usage: true },
    orderBy: { createdAt: 'desc' },
  });

  if (subscription?.usage) {
    await prisma.usageLimit.update({
      where: { id: subscription.usage.id },
      data: {
        documentsUsed: { increment: count },
      },
    });
  } else if (subscription) {
    await prisma.usageLimit.create({
      data: {
        subscriptionId: subscription.id,
        documentsUsed: count,
      },
    });
  }
}

/**
 * Increment workspace usage
 */
export async function incrementWorkspaceUsage(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: { usage: true },
    orderBy: { createdAt: 'desc' },
  });

  if (subscription?.usage) {
    await prisma.usageLimit.update({
      where: { id: subscription.usage.id },
      data: {
        workspacesUsed: { increment: 1 },
      },
    });
  } else if (subscription) {
    await prisma.usageLimit.create({
      data: {
        subscriptionId: subscription.id,
        workspacesUsed: 1,
      },
    });
  }
}

/**
 * Increment message usage
 */
export async function incrementMessageUsage(userId: string, count = 1): Promise<void> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: { usage: true },
    orderBy: { createdAt: 'desc' },
  });

  if (subscription?.usage) {
    await prisma.usageLimit.update({
      where: { id: subscription.usage.id },
      data: {
        messagesUsed: { increment: count },
      },
    });
  } else if (subscription) {
    await prisma.usageLimit.create({
      data: {
        subscriptionId: subscription.id,
        messagesUsed: count,
      },
    });
  }
}

/**
 * Get full usage summary for user
 */
export async function getUsageSummary(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: {
      plan: true,
      usage: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    return null;
  }

  const usage = subscription.usage || {
    workspacesUsed: 0,
    documentsUsed: 0,
    storageUsed: BigInt(0),
    messagesUsed: 0,
    apiCallsUsed: 0,
  };

  return {
    plan: subscription.plan,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    usage: {
      workspaces: {
        used: usage.workspacesUsed,
        limit: subscription.plan.maxWorkspaces,
        percentage: Math.round((usage.workspacesUsed / subscription.plan.maxWorkspaces) * 100),
      },
      documents: {
        used: usage.documentsUsed,
        limit: subscription.plan.maxDocuments,
        percentage: Math.round((usage.documentsUsed / subscription.plan.maxDocuments) * 100),
      },
      storage: {
        used: Number(usage.storageUsed),
        limit: Number(subscription.plan.maxStorageBytes),
        percentage: Math.round(
          (Number(usage.storageUsed) / Number(subscription.plan.maxStorageBytes)) * 100
        ),
      },
      messages: {
        used: usage.messagesUsed,
        limit: subscription.plan.maxMessages,
        percentage: Math.round((usage.messagesUsed / subscription.plan.maxMessages) * 100),
      },
      apiCalls: {
        used: usage.apiCallsUsed,
        limit: subscription.plan.maxApiCalls,
        percentage: Math.round((usage.apiCallsUsed / subscription.plan.maxApiCalls) * 100),
      },
    },
  };
}
