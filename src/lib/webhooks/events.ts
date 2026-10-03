/**
 * Canonical webhook event identifiers.
 *
 * Kept free of server-only imports (Prisma, node:crypto) so client
 * components can share the exact same event list as the delivery service.
 */

export const WebhookEvents = {
  // Document events
  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_PROCESSED: 'document.processed',
  DOCUMENT_PROCESSING_FAILED: 'document.processing_failed',

  // Chat events
  CHAT_CREATED: 'chat.created',
  CHAT_MESSAGE_SENT: 'chat.message_sent',
  CHAT_DELETED: 'chat.deleted',

  // Workspace events
  WORKSPACE_UPDATED: 'workspace.updated',
  MEMBER_JOINED: 'member.joined',
  MEMBER_LEFT: 'member.left',

  // API events
  API_KEY_CREATED: 'api_key.created',
  API_KEY_REVOKED: 'api_key.revoked',

  // Webhook events
  WEBHOOK_TEST: 'webhook.test',

  // Wildcard for all events
  ALL: '*',
} as const;

export type WebhookEventType = (typeof WebhookEvents)[keyof typeof WebhookEvents];

/**
 * Get all available webhook event types
 */
export function getAvailableWebhookEvents(): Array<{
  value: string;
  label: string;
  description: string;
}> {
  return [
    {
      value: WebhookEvents.DOCUMENT_CREATED,
      label: 'Document Created',
      description: 'Triggered when a new document is uploaded',
    },
    {
      value: WebhookEvents.DOCUMENT_UPDATED,
      label: 'Document Updated',
      description: 'Triggered when a document is updated',
    },
    {
      value: WebhookEvents.DOCUMENT_DELETED,
      label: 'Document Deleted',
      description: 'Triggered when a document is deleted',
    },
    {
      value: WebhookEvents.DOCUMENT_PROCESSED,
      label: 'Document Processed',
      description: 'Triggered when document ingestion completes',
    },
    {
      value: WebhookEvents.DOCUMENT_PROCESSING_FAILED,
      label: 'Document Processing Failed',
      description: 'Triggered when document ingestion fails',
    },
    {
      value: WebhookEvents.CHAT_CREATED,
      label: 'Chat Created',
      description: 'Triggered when a new chat is created',
    },
    {
      value: WebhookEvents.CHAT_MESSAGE_SENT,
      label: 'Chat Message Sent',
      description: 'Triggered when a message is sent in a chat',
    },
    {
      value: WebhookEvents.CHAT_DELETED,
      label: 'Chat Deleted',
      description: 'Triggered when a chat is deleted',
    },
    {
      value: WebhookEvents.MEMBER_JOINED,
      label: 'Member Joined',
      description: 'Triggered when a member joins the workspace',
    },
    {
      value: WebhookEvents.MEMBER_LEFT,
      label: 'Member Left',
      description: 'Triggered when a member leaves the workspace',
    },
    {
      value: WebhookEvents.API_KEY_CREATED,
      label: 'API Key Created',
      description: 'Triggered when an API key is created',
    },
    {
      value: WebhookEvents.API_KEY_REVOKED,
      label: 'API Key Revoked',
      description: 'Triggered when an API key is revoked',
    },
  ];
}
