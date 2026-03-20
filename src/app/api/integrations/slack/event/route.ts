/**
 * Slack Event Subscription Handler
 *
 * POST /api/integrations/slack/event
 * Handles incoming events from Slack's Events API
 */

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { SlackIntegration } from '@/lib/integrations/slack';

export const dynamic = 'force-dynamic';

// Slack event types
interface SlackEvent {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
  channel?: string;
  event_ts?: string;
  channel_type?: string;
  team?: string;
  subtype?: string;
}

interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event?: SlackEvent;
  challenge?: string;
  type: string;
  event_id?: string;
  event_time?: number;
  authorizations?: Array<{
    enterprise_id: string | null;
    team_id: string;
    user_id: string;
    is_bot: boolean;
    is_enterprise_install: boolean;
  }>;
}

/**
 * POST /api/integrations/slack/event
 * Handle incoming events from Slack
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the JSON payload from Slack
    let payload: SlackEventPayload;
    try {
      payload = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON payload from Slack event', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle URL verification challenge
    if (payload.type === 'url_verification' && payload.challenge) {
      logger.info('Received Slack URL verification challenge');
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Verify the request is from Slack
    const isValid = await verifySlackEvent(request, payload);
    if (!isValid) {
      logger.warn('Invalid Slack event signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle different event types
    if (payload.type === 'event_callback' && payload.event) {
      return handleEventCallback(payload);
    }

    // Unknown event type
    logger.warn('Unknown Slack event type', { type: payload.type });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Error handling Slack event', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return 200 to prevent Slack from retrying
    // Log the error but don't expose it to Slack
    return NextResponse.json({ ok: false });
  }
}

/**
 * Handle event callback from Slack
 */
async function handleEventCallback(payload: SlackEventPayload): Promise<Response> {
  const event = payload.event;

  if (!event) {
    return NextResponse.json({ ok: true });
  }

  logger.debug('Received Slack event', {
    type: event.type,
    teamId: payload.team_id,
  });

  switch (event.type) {
    case 'app_mention':
      return handleAppMention(payload);

    case 'message':
      // Ignore messages from bots and subtype messages
      if (event.channel_type === 'im' && !event.subtype) {
        return handleDirectMessage(payload);
      }
      break;

    case 'member_joined_channel':
      return handleMemberJoinedChannel(payload);

    case 'app_uninstalled':
      return handleAppUninstalled(payload);

    default:
      logger.debug('Unhandled Slack event type', { type: event.type });
  }

  // Acknowledge the event
  return NextResponse.json({ ok: true });
}

/**
 * Handle app mention event
 */
async function handleAppMention(payload: SlackEventPayload): Promise<Response> {
  const event = payload.event;

  if (!event?.text || !event.channel) {
    return NextResponse.json({ ok: true });
  }

  try {
    // Find the integration for this team
    const integration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'slack',
        providerAccountId: payload.team_id,
      },
    });

    if (!integration) {
      logger.warn('No integration found for Slack team', {
        teamId: payload.team_id,
      });
      return NextResponse.json({ ok: true });
    }

    // Create Slack integration instance
    const slackIntegration = new SlackIntegration(integration.accessToken);

    // Extract the message (remove bot mention)
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!text) {
      await slackIntegration.sendMessage(
        event.channel,
        "Hello! I'm RAG Bot. You can ask me questions about your documents or type `/rag help` for more options."
      );
      return NextResponse.json({ ok: true });
    }

    // Process the message as a query
    // Note: This requires user linking - for now, send a helpful message
    await slackIntegration.sendMessage(
      event.channel,
      'Thanks for mentioning me! To ask questions about your documents, please use the `/rag ask <question>` command.'
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Error handling app mention', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ ok: true });
  }
}

/**
 * Handle direct message event
 */
async function handleDirectMessage(payload: SlackEventPayload): Promise<Response> {
  const event = payload.event;

  if (!event?.text || !event.channel || !event.user) {
    return NextResponse.json({ ok: true });
  }

  try {
    // Find the integration for this team
    const integration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'slack',
        providerAccountId: payload.team_id,
      },
    });

    if (!integration) {
      logger.warn('No integration found for Slack team', {
        teamId: payload.team_id,
      });
      return NextResponse.json({ ok: true });
    }

    // Create Slack integration instance
    const slackIntegration = new SlackIntegration(integration.accessToken);

    // Send helpful response for DMs
    await slackIntegration.sendMessage(
      event.channel,
      `Hi <@${event.user}>! 👋\n\nI'm RAG Bot. Here are the commands you can use:\n\n• \`/rag ask <question>\` - Ask a question about your documents\n• \`/rag search <query>\` - Search your documents\n• \`/rag docs\` - List your documents\n• \`/rag help\` - Show all commands\n\nMake sure your Slack account is linked to your RAG account at ${process.env.NEXTAUTH_URL}/settings/integrations`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Error handling direct message', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ ok: true });
  }
}

/**
 * Handle member joined channel event
 */
async function handleMemberJoinedChannel(payload: SlackEventPayload): Promise<Response> {
  const event = payload.event;

  logger.info('Bot joined channel', {
    teamId: payload.team_id,
    channel: event?.channel,
    user: event?.user,
  });

  // Could send a welcome message here
  return NextResponse.json({ ok: true });
}

/**
 * Handle app uninstalled event
 */
async function handleAppUninstalled(payload: SlackEventPayload): Promise<Response> {
  logger.info('App uninstalled from Slack workspace', {
    teamId: payload.team_id,
  });

  try {
    // Find and delete the integration
    const integration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'slack',
        providerAccountId: payload.team_id,
      },
    });

    if (integration) {
      await prisma.integrationAccount.delete({
        where: { id: integration.id },
      });

      logger.info('Deleted Slack integration after app uninstall', {
        integrationId: integration.id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Error handling app uninstall', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ ok: true });
  }
}

/**
 * Verify the Slack event signature
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
async function verifySlackEvent(
  request: NextRequest,
  _payload: SlackEventPayload
): Promise<boolean> {
  try {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    // Skip verification in development if no signing secret is set
    if (!signingSecret) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Skipping Slack signature verification in development');
        return true;
      }
      logger.error('SLACK_SIGNING_SECRET not configured');
      return false;
    }

    // Get headers
    const timestamp = request.headers.get('x-slack-request-timestamp');
    const signature = request.headers.get('x-slack-signature');

    if (!timestamp || !signature) {
      logger.warn('Missing Slack signature headers');
      return false;
    }

    // Check if timestamp is within 5 minutes to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 300) {
      logger.warn('Slack request timestamp too old', { timestamp, now });
      return false;
    }

    // Clone the request to read the body
    const clonedRequest = request.clone();
    const body = await clonedRequest.text();

    // Create the signature base string
    const sigBaseString = `v0:${timestamp}:${body}`;

    // Calculate expected signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(sigBaseString));

    const expectedSignature =
      'v0=' +
      Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    // Compare signatures using timing-safe comparison
    return timingSafeEqual(signature, expectedSignature);
  } catch (error) {
    logger.error('Error verifying Slack event', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
