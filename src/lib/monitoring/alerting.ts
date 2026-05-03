/**
 * Alerting Module
 *
 * Handles anomaly alerts by logging CRITICAL audit events
 * and optionally sending email/webhook notifications.
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import type { AnomalyAlert } from './anomaly-detector';

export interface AlertConfig {
  webhookUrl?: string;
  emailRecipients?: string[];
}

/**
 * Process and dispatch an anomaly alert.
 */
export async function dispatchAlert(alert: AnomalyAlert): Promise<void> {
  // Always log as a CRITICAL audit event for the immutable trail
  await logAuditEvent({
    event: AuditEvent.SUSPICIOUS_ACTIVITY,
    userId: alert.userId,
    workspaceId: alert.workspaceId,
    severity: alert.severity,
    metadata: {
      activity: `anomaly:${alert.type}`,
      description: alert.description,
      ...alert.metadata,
    },
  });

  // Send webhook notification if configured
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${alert.severity}] ${alert.type}: ${alert.description}`,
          alert,
        }),
      });
    } catch (error) {
      logger.error('Failed to send alert webhook', {
        type: alert.type,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  logger.warn('Security alert dispatched', {
    type: alert.type,
    severity: alert.severity,
    description: alert.description,
  });
}
