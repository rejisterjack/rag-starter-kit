/**
 * Slack Slash Command Handler
 *
 * POST /api/integrations/slack/command
 * Handles incoming slash commands from Slack
 */

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SlackIntegration } from '@/lib/integrations/slack';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Required Slack command fields
interface SlackCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  api_app_id?: string;
}

/**
 * POST /api/integrations/slack/command
 * Handle incoming Slack slash commands
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the form data from Slack
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      logger.warn('Invalid form data from Slack command', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return NextResponse.json({ text: 'Invalid request format' }, { status: 400 });
    }

    // Extract command payload
    const payload = extractCommandPayload(formData);

    // Verify the request is from Slack
    const isValid = await verifySlackRequest(request, payload);
    if (!isValid) {
      logger.warn('Invalid Slack request signature', {
        teamId: payload.team_id,
        userId: payload.user_id,
      });
      return NextResponse.json({ text: 'Invalid request signature' }, { status: 401 });
    }

    // Verify the token matches our expected token
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      logger.error('SLACK_SIGNING_SECRET not configured');
      return NextResponse.json({ text: 'Server configuration error' }, { status: 500 });
    }

    // Find the integration account for this team
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
      return NextResponse.json({
        text: 'This workspace is not connected to RAG. Please connect your workspace first.',
        response_type: 'ephemeral',
      });
    }

    // Create Slack integration instance
    const slackIntegration = new SlackIntegration(integration.accessToken);

    // Handle the command
    const response = await slackIntegration.handleCommand({
      token: payload.token,
      team_id: payload.team_id,
      team_domain: payload.team_domain,
      channel_id: payload.channel_id,
      channel_name: payload.channel_name,
      user_id: payload.user_id,
      user_name: payload.user_name,
      command: payload.command,
      text: payload.text,
      response_url: payload.response_url,
      trigger_id: payload.trigger_id,
    });

    // Return response to Slack
    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error handling Slack command', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        text: 'An error occurred while processing your command. Please try again.',
        response_type: 'ephemeral',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract command payload from form data
 */
function extractCommandPayload(formData: FormData): SlackCommandPayload {
  return {
    token: getStringValue(formData, 'token'),
    team_id: getStringValue(formData, 'team_id'),
    team_domain: getStringValue(formData, 'team_domain'),
    channel_id: getStringValue(formData, 'channel_id'),
    channel_name: getStringValue(formData, 'channel_name'),
    user_id: getStringValue(formData, 'user_id'),
    user_name: getStringValue(formData, 'user_name'),
    command: getStringValue(formData, 'command'),
    text: getStringValue(formData, 'text'),
    response_url: getStringValue(formData, 'response_url'),
    trigger_id: getStringValue(formData, 'trigger_id'),
    api_app_id: getStringValue(formData, 'api_app_id') || undefined,
  };
}

/**
 * Get string value from form data
 */
function getStringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return value?.toString() ?? '';
}

/**
 * Verify the Slack request signature
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
async function verifySlackRequest(
  request: NextRequest,
  _payload: SlackCommandPayload
): Promise<boolean> {
  try {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
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
    if (Number.isNaN(requestTime) || Math.abs(now - requestTime) > 300) {
      logger.warn('Slack request timestamp too old', { timestamp, now });
      return false;
    }

    // For form data requests, we need to verify using the raw body
    // Since Next.js already parsed the body, we'll use a simpler verification
    // In production, you should implement raw body verification

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
    logger.error('Error verifying Slack request', {
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
