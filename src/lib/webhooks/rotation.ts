/**
 * Webhook Secret Rotation
 * 
 * Implements secure secret rotation for webhooks without breaking existing deliveries.
 * Supports graceful rotation with primary and secondary secrets.
 */

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface WebhookSecrets {
  primary: string;
  secondary: string | null;
  rotatedAt: Date | null;
}

export interface RotationResult {
  success: boolean;
  newSecret: string;
  previousSecret: string | null;
  error?: string;
}

// ============================================================================
// Secret Generation
// ============================================================================

/**
 * Generate a new cryptographically secure webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('base64')}`;
}

// ============================================================================
// Secret Rotation
// ============================================================================

/**
 * Rotate webhook secret for a workspace
 * 
 * The rotation process:
 * 1. Current primary secret becomes secondary (grace period)
 * 2. New secret is generated as primary
 * 3. After grace period, secondary secret is removed
 */
export async function rotateWebhookSecret(
  webhookId: string,
  options: { gracePeriodDays?: number } = {}
): Promise<RotationResult> {
  const gracePeriodDays = options.gracePeriodDays ?? 7;

  try {
    // Get current webhook
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return {
        success: false,
        newSecret: '',
        previousSecret: null,
        error: 'Webhook not found',
      };
    }

    // Generate new secret
    const newSecret = generateWebhookSecret();
    const previousSecret = webhook.secret;

    // Update webhook with rotation
    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        secret: newSecret,
        // Store rotation metadata in a separate field or table if needed
        // For now, we'll use the existing metadata JSON field
        metadata: {
          ...((webhook as unknown as { metadata?: Record<string, unknown> }).metadata || {}),
          previousSecret,
          rotatedAt: new Date().toISOString(),
          gracePeriodDays,
        },
      },
    });

    logger.info('Webhook secret rotated', {
      webhookId,
      gracePeriodDays,
    });

    return {
      success: true,
      newSecret,
      previousSecret,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to rotate webhook secret', {
      webhookId,
      error: errorMessage,
    });

    return {
      success: false,
      newSecret: '',
      previousSecret: null,
      error: errorMessage,
    };
  }
}

/**
 * Complete rotation by removing secondary secret after grace period
 */
export async function completeWebhookRotation(webhookId: string): Promise<boolean> {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return false;
    }

    const metadata = (webhook as unknown as { metadata?: Record<string, unknown> }).metadata || {};
    const rotatedAt = metadata.rotatedAt ? new Date(metadata.rotatedAt as string) : null;

    if (!rotatedAt) {
      return false;
    }

    const gracePeriodDays = (metadata.gracePeriodDays as number) || 7;
    const gracePeriodEnd = new Date(rotatedAt);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

    // Check if grace period has expired
    if (new Date() < gracePeriodEnd) {
      return false;
    }

    // Remove previous secret from metadata
    const { previousSecret: _, rotatedAt: __, gracePeriodDays: ___, ...cleanMetadata } = metadata;

    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        metadata: cleanMetadata,
      },
    });

    logger.info('Webhook rotation completed', {
      webhookId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to complete webhook rotation', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get webhook secrets including previous secret during grace period
 */
export async function getWebhookSecrets(webhookId: string): Promise<WebhookSecrets | null> {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return null;
    }

    const metadata = (webhook as unknown as { metadata?: Record<string, unknown> }).metadata || {};
    const previousSecret = metadata.previousSecret as string | undefined;
    const rotatedAt = metadata.rotatedAt ? new Date(metadata.rotatedAt as string) : null;

    return {
      primary: webhook.secret,
      secondary: previousSecret || null,
      rotatedAt,
    };
  } catch (error) {
    logger.error('Failed to get webhook secrets', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Verify signature with support for previous secret during grace period
 */
export async function verifyWebhookSignatureWithRotation(
  webhookId: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const secrets = await getWebhookSecrets(webhookId);

  if (!secrets) {
    return false;
  }

  // Try primary secret first
  if (verifySignature(payload, signature, secrets.primary)) {
    return true;
  }

  // Try secondary secret if in grace period
  if (secrets.secondary) {
    const gracePeriodDays = 7;
    const gracePeriodEnd = secrets.rotatedAt 
      ? new Date(secrets.rotatedAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
      : null;

    if (!gracePeriodEnd || new Date() < gracePeriodEnd) {
      if (verifySignature(payload, signature, secrets.secondary)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Simple signature verification (extracted for reuse)
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const { createHmac } = require('crypto');
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  
  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    return sigBuf.length === expectedBuf.length && sigBuf.equals(expectedBuf);
  } catch {
    return false;
  }
}

// ============================================================================
// Scheduled Cleanup
// ============================================================================

/**
 * Complete all expired webhook rotations
 * Call this from a cron job or scheduled function
 */
export async function cleanupExpiredRotations(): Promise<number> {
  try {
    // Find all webhooks with expired grace periods
    const webhooks = await prisma.webhook.findMany({
      where: {
        metadata: {
          path: ['rotatedAt'],
          not: null,
        },
      },
    });

    let completed = 0;

    for (const webhook of webhooks) {
      const success = await completeWebhookRotation(webhook.id);
      if (success) {
        completed++;
      }
    }

    logger.info('Completed expired webhook rotations', {
      completed,
      total: webhooks.length,
    });

    return completed;
  } catch (error) {
    logger.error('Failed to cleanup expired rotations', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}
