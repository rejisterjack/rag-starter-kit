/**
 * Webhooks Library
 *
 * Provides utilities for webhook management and delivery.
 */

// Delivery
export {
  buildWebhookPayload,
  deliverToMultiple,
  deliverWebhook,
  generateWebhookSecret,
  generateWebhookSignature,
  getAvailableWebhookEvents,
  testWebhook,
  verifyWebhookSignature,
  WebhookEvents,
} from './delivery';

export type {
  DeliveryResult,
  WebhookDeliveryOptions,
  WebhookEventType,
  WebhookPayload,
} from './delivery';

// Secret Rotation
export {
  cleanupExpiredRotations,
  completeWebhookRotation,
  generateWebhookSecret as generateSecureWebhookSecret,
  getWebhookSecrets,
  rotateWebhookSecret,
  verifyWebhookSignatureWithRotation,
} from './rotation';

export type { RotationResult, WebhookSecrets } from './rotation';

// Idempotency
export {
  checkIdempotencyKey,
  cleanupIdempotencyKeys,
  deleteIdempotencyKey,
  generateIdempotencyKey,
  IdempotencyError,
  isDuplicateEvent,
  markIdempotencyKeyProcessed,
  parseIdempotencyKey,
  processWithIdempotency,
  storeIdempotencyKey,
} from './idempotency';
