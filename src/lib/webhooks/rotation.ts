/**
 * Webhook Secret Rotation
 *
 * Implements secure secret rotation for webhooks.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

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
 * Rotate webhook secret
 */
export async function rotateWebhookSecret(webhookId: string): Promise<RotationResult> {
  try {
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

    const newSecret = generateWebhookSecret();
    const previousSecret = webhook.secret;

    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        secret: newSecret,
      },
    });

    logger.info('Webhook secret rotated', { webhookId });

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
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    return sigBuf.length === expectedBuf.length && sigBuf.equals(expectedBuf);
  } catch (error: unknown) {
    logger.error('Failed to verify webhook signature', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
