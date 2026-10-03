/**
 * Webhooks Library
 *
 * Provides utilities for webhook management and delivery.
 */

export type { DeliveryResult, WebhookDeliveryOptions, WebhookPayload } from './delivery';
// Delivery
export {
  buildWebhookPayload,
  deliverToMultiple,
  deliverWebhook,
  generateWebhookSecret,
  generateWebhookSignature,
  recordDelivery,
  testWebhook,
  verifyWebhookSignature,
} from './delivery';
export type { WebhookEventType } from './events';
// Event types (client-safe)
export { getAvailableWebhookEvents, WebhookEvents } from './events';
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

export type { RotationResult } from './rotation';
// Secret Rotation
export {
  generateWebhookSecret as generateSecureWebhookSecret,
  rotateWebhookSecret,
} from './rotation';
