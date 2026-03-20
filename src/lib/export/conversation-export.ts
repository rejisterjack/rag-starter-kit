/**
 * Conversation Export
 *
 * Export conversations to various formats including PDF and Markdown.
 */

import { prisma } from '@/lib/db';
import type { Message, Source } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  includeMetadata?: boolean;
  includeSources?: boolean;
  dateFormat?: 'iso' | 'locale' | 'relative';
  maxMessages?: number;
}

export interface ExportedConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Markdown Export
// ============================================================================

/**
 * Export conversation to Markdown format
 */
export async function exportConversationToMarkdown(
  conversationId: string,
  options: ExportOptions = {}
): Promise<string> {
  const { includeMetadata = true, includeSources = true, dateFormat = 'locale' } = options;

  const conversation = await prisma.chat.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const lines: string[] = [];

  // Header
  lines.push(`# ${conversation.title}`);
  lines.push('');

  // Metadata
  if (includeMetadata) {
    lines.push('## Metadata');
    lines.push('');
    lines.push(`- **Conversation ID:** ${conversation.id}`);
    lines.push(`- **Created:** ${formatDate(conversation.createdAt, dateFormat)}`);
    lines.push(`- **Updated:** ${formatDate(conversation.updatedAt, dateFormat)}`);
    lines.push(`- **Messages:** ${conversation.messages.length}`);
    lines.push('');
  }

  // Messages
  lines.push('## Conversation');
  lines.push('');

  for (const message of conversation.messages) {
    const role =
      message.role === 'USER' ? 'User' : message.role === 'ASSISTANT' ? 'Assistant' : 'System';

    lines.push(`### ${role} (${formatDate(message.createdAt, dateFormat)})`);
    lines.push('');
    lines.push(message.content);
    lines.push('');

    // Include sources if available
    if (includeSources && message.sources) {
      const sources = (message.sources as unknown as Source[]) ?? [];
      if (sources.length > 0) {
        lines.push('**Sources:**');
        lines.push('');
        sources.forEach((source, index) => {
          lines.push(`${index + 1}. **${source.metadata.documentName}**`);
          if (source.metadata.page) {
            lines.push(`   - Page: ${source.metadata.page}`);
          }
          if (source.similarity) {
            lines.push(`   - Relevance: ${(source.similarity * 100).toFixed(1)}%`);
          }
          lines.push(
            `   - Content: "${source.content.slice(0, 200)}${source.content.length > 200 ? '...' : ''}"`
          );
          lines.push('');
        });
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export multiple conversations to Markdown
 */
export async function exportConversationsToMarkdown(
  conversationIds: string[],
  options: ExportOptions = {}
): Promise<string> {
  const exports = await Promise.all(
    conversationIds.map((id) => exportConversationToMarkdown(id, options))
  );

  return exports.join('\n\n---\n\n# New Conversation\n\n');
}

// ============================================================================
// PDF Export
// ============================================================================

/**
 * Export conversation to PDF format
 * Uses @react-pdf/renderer for actual PDF generation
 */
export async function exportConversationToPDF(
  conversationId: string,
  options: ExportOptions = {}
): Promise<Buffer> {
  // Import the PDF generator dynamically
  const { generatePDF } = await import('./pdf-generator');

  const conversation = await prisma.chat.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  // Convert to ExportConversation format
  const exportConversation = {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      createdAt: m.createdAt,
      sources: [],
    })),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };

  // Generate PDF using the proper PDF generator
  return generatePDF(exportConversation, {
    ...options,
    format: 'pdf',
    pageSize: 'A4',
    includeHeader: true,
    includeFooter: true,
  });
}

/**
 * Export conversation to HTML (for PDF generation)
 */
export async function exportConversationToHTML(
  conversationId: string,
  options: ExportOptions = {}
): Promise<string> {
  const { includeMetadata = true, includeSources = true, dateFormat = 'locale' } = options;

  const conversation = await prisma.chat.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const htmlParts: string[] = [];

  htmlParts.push(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(conversation.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    h3 { color: #555; margin-top: 25px; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .metadata ul { margin: 0; padding-left: 20px; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .message.user { background: #e3f2fd; }
    .message.assistant { background: #f3e5f5; }
    .message.system { background: #f5f5f5; font-style: italic; }
    .message-header { font-weight: bold; margin-bottom: 10px; color: #555; }
    .sources { margin-top: 15px; padding: 10px; background: #fafafa; border-radius: 5px; }
    .source { margin: 10px 0; padding: 10px; border-left: 3px solid #2196f3; }
    pre { background: #f5f5f5; padding: 15px; overflow-x: auto; border-radius: 5px; }
    code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 30px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(conversation.title)}</h1>
`);

  if (includeMetadata) {
    htmlParts.push(`
  <div class="metadata">
    <h2>Metadata</h2>
    <ul>
      <li><strong>Conversation ID:</strong> ${conversation.id}</li>
      <li><strong>Created:</strong> ${formatDate(conversation.createdAt, dateFormat)}</li>
      <li><strong>Updated:</strong> ${formatDate(conversation.updatedAt, dateFormat)}</li>
      <li><strong>Messages:</strong> ${conversation.messages.length}</li>
    </ul>
  </div>
`);
  }

  htmlParts.push(`  <h2>Conversation</h2>`);

  for (const message of conversation.messages) {
    const roleClass = message.role.toLowerCase();
    const roleLabel =
      message.role === 'USER' ? 'User' : message.role === 'ASSISTANT' ? 'Assistant' : 'System';

    htmlParts.push(`
  <div class="message ${roleClass}">
    <div class="message-header">${roleLabel} - ${formatDate(message.createdAt, dateFormat)}</div>
    <div class="content">${formatContent(message.content)}</div>
`);

    if (includeSources && message.sources) {
      const sources = (message.sources as unknown as Source[]) ?? [];
      if (sources.length > 0) {
        htmlParts.push(`    <div class="sources">
      <strong>Sources:</strong>`);

        sources.forEach((source, index) => {
          htmlParts.push(`
      <div class="source">
        <strong>${index + 1}. ${escapeHtml(source.metadata.documentName)}</strong>
        ${source.metadata.page ? `<br>Page: ${source.metadata.page}` : ''}
        ${source.similarity ? `<br>Relevance: ${(source.similarity * 100).toFixed(1)}%` : ''}
        <br><em>${escapeHtml(source.content.slice(0, 200))}${source.content.length > 200 ? '...' : ''}</em>
      </div>`);
        });

        htmlParts.push(`    </div>`);
      }
    }

    htmlParts.push(`  </div>`);
  }

  htmlParts.push(`
</body>
</html>`);

  return htmlParts.join('\n');
}

// ============================================================================
// JSON Export
// ============================================================================

/**
 * Export conversation to JSON format
 */
export async function exportConversationToJSON(
  conversationId: string,
  options: ExportOptions = {}
): Promise<string> {
  const { includeMetadata = true, includeSources = true } = options;

  const conversation = await prisma.chat.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const exportData: ExportedConversation = {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map(
      (msg: {
        id: string;
        content: string;
        role: string;
        createdAt: Date;
        chatId: string;
        sources?: unknown;
      }) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant' | 'system',
        createdAt: msg.createdAt,
        chatId: msg.chatId,
        sources: includeSources ? (msg.sources as Source[] | undefined) : undefined,
      })
    ),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };

  if (includeMetadata) {
    exportData.metadata = conversation.metadata as Record<string, unknown> | undefined;
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export conversation to CSV format
 */
export async function exportConversationToCSV(
  conversationId: string,
  _options: ExportOptions = {}
): Promise<string> {
  const conversation = await prisma.chat.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const lines: string[] = [];
  lines.push('Timestamp,Role,Content,Source Count');

  for (const message of conversation.messages) {
    const timestamp = message.createdAt.toISOString();
    const role = message.role;
    const content = escapeCsv(message.content);
    const sourceCount = message.sources ? ((message.sources as unknown) as Source[]).length : 0;

    lines.push(`${timestamp},${role},"${content}",${sourceCount}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date, format: 'iso' | 'locale' | 'relative'): string {
  switch (format) {
    case 'iso':
      return date.toISOString();
    case 'locale':
      return date.toLocaleString();
    case 'relative':
      return getRelativeTime(date);
    default:
      return date.toLocaleString();
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeCsv(text: string): string {
  return text.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '');
}

function formatContent(content: string): string {
  // Convert markdown to HTML
  return escapeHtml(content)
    .replace(/\\n/g, '<br>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// ============================================================================
// Export
// ============================================================================

// Types are already exported above
