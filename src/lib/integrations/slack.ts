/**
 * Slack Bot Integration
 */

import { prisma } from '@/lib/db';

export interface SlackCommand {
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
}

export interface SlackEvent {
  type: string;
  user: string;
  text: string;
  ts: string;
  channel: string;
  event_ts: string;
}

export interface SlackCommandResponse {
  text: string;
  response_type?: 'ephemeral' | 'in_channel';
}

interface ChatResponseData {
  content?: string;
  sources?: Array<{ documentName: string }>;
}

interface ChatApiResponse {
  data?: ChatResponseData;
  error?: string;
}

export class SlackIntegration {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Handle slash commands
   */
  async handleCommand(command: SlackCommand): Promise<SlackCommandResponse> {
    const { text, user_id } = command;

    // Find linked user
    const userLink = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'slack',
        providerAccountId: user_id,
      },
    });

    if (!userLink) {
      return {
        text: `Please connect your Slack account to RAG first. Visit ${process.env.NEXTAUTH_URL}/settings/integrations`,
        response_type: 'ephemeral',
      };
    }

    const subcommand = text.split(' ')[0];
    const args = text.slice(subcommand.length).trim();

    switch (subcommand) {
      case 'ask':
      case '':
        return this.handleAsk(args, userLink.userId);
      
      case 'save':
        return this.handleSave(args, command.channel_id);
      
      case 'search':
        return this.handleSearch(args, userLink.userId);
      
      case 'docs':
        return this.handleListDocs(userLink.userId);
      
      case 'help':
        return this.handleHelp();
      
      default:
        return {
          text: `Unknown command: ${subcommand}. Try /rag help`,
          response_type: 'ephemeral',
        };
    }
  }

  private async handleAsk(query: string, userId: string): Promise<SlackCommandResponse> {
    if (!query) {
      return { text: 'Please provide a question. Usage: `/rag ask <question>`' };
    }

    try {
      // Call RAG API
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getUserApiKey(userId)}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: query }],
          stream: false,
        }),
      });

      const data = await response.json() as ChatApiResponse;
      
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to get answer');
      }

      let responseText = data.data?.content ?? '';
      
      // Add sources if available
      const sources = data.data?.sources;
      if (sources !== undefined && sources.length > 0) {
        responseText += '\n\n*Sources:*';
        for (const source of sources) {
          responseText += `\n• ${source.documentName}`;
        }
      }

      return { text: responseText };
    } catch (error) {
      return { text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async handleSave(_args: string, _channelId: string): Promise<SlackCommandResponse> {
    // Get recent messages from channel and save as document
    return {
      text: 'Saving conversation to RAG... (Feature coming soon)',
    };
  }

  private async handleSearch(query: string, userId: string): Promise<SlackCommandResponse> {
    if (!query) {
      return { text: 'Please provide a search query. Usage: `/rag search <query>`' };
    }

    // Search documents
    const documents = await prisma.document.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    if (documents.length === 0) {
      return { text: `No documents found matching "${query}"` };
    }

    let text = `*Found ${documents.length} documents:*`;
    documents.forEach((doc, idx) => {
      text += `\n${idx + 1}. ${doc.name}`;
    });

    return { text };
  }

  private async handleListDocs(userId: string): Promise<SlackCommandResponse> {
    const documents = await prisma.document.findMany({
      where: { userId },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });

    if (documents.length === 0) {
      return { text: 'You have no documents. Upload some at the web app!' };
    }

    let text = '*Your recent documents:*';
    documents.forEach((doc, idx) => {
      text += `\n${idx + 1}. ${doc.name}`;
    });

    return { text };
  }

  private handleHelp(): SlackCommandResponse {
    return {
      text: `*RAG Bot Commands:*
• \`/rag ask <question>\` - Ask a question
• \`/rag search <query>\` - Search documents
• \`/rag docs\` - List your documents
• \`/rag help\` - Show this help`,
    };
  }

  private async getUserApiKey(userId: string): Promise<string> {
    // Get or create API key for user
    const apiKey = await prisma.apiKey.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (apiKey) {
      return apiKey.keyPreview; // In real implementation, would decrypt full key
    }

    // Create new API key
    const newKey = await prisma.apiKey.create({
      data: {
        userId,
        name: 'Slack Integration',
        keyHash: 'placeholder',
        keyPreview: 'placeholder',
        permissions: ['chat:read', 'chat:write', 'documents:read'],
        status: 'ACTIVE',
      },
    });

    return newKey.keyPreview;
  }

  /**
   * Send message to Slack channel
   */
  async sendMessage(channel: string, text: string, blocks?: unknown[]): Promise<void> {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        blocks,
      }),
    });
  }
}

export default SlackIntegration;
