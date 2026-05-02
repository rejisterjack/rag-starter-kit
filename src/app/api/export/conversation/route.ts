/**
 * Export API Route
 * Handles conversation export to various formats
 */

import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { withApiAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { ExportCitation, ExportMessage } from '@/lib/export/types';
import { logger } from '@/lib/logger';
import type { Citation } from '@/lib/rag/citations';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

interface SourceItem {
  id: string;
  content: string;
  metadata?: { documentId?: string; documentName?: string; page?: number };
  similarity?: number;
}

interface MessageItem {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  sources: unknown;
}

export const POST = withApiAuth(async (req, session) => {
  try {
    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Rate limiting
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'export', {
      userId,
      workspaceId,
      endpoint: '/api/export/conversation',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Parse request
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in conversation export', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { conversationId, format, includeCitations, includeSources, citationStyle } = body as {
      conversationId: string;
      format: 'pdf' | 'markdown' | 'html' | 'json';
      includeCitations?: boolean;
      includeSources?: boolean;
      citationStyle?: 'numbered' | 'footnote';
    };

    if (!conversationId || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, format' },
        { status: 400 }
      );
    }

    // Verify access to conversation
    const chat = await prisma.chat.findFirst({
      where: {
        id: conversationId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check export permission for workspace chats
    if (chat.workspaceId && chat.userId !== userId) {
      const canExport = await checkPermission(userId, chat.workspaceId, Permission.READ_DOCUMENTS);
      if (!canExport) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Log export
    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED, // Using existing event
      userId,
      workspaceId: chat.workspaceId ?? undefined,
      metadata: {
        action: 'export_conversation',
        conversationId,
        format,
        includeCitations,
      },
    });

    // Format messages for export
    const messages: ExportMessage[] = chat.messages.map((msg) => {
      const messageItem: MessageItem = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        sources: msg.sources,
      };

      const citations: ExportCitation[] | undefined = includeCitations
        ? parseSources(messageItem.sources).map(
            (s: SourceItem): ExportCitation => ({
              id: s.id,
              chunkId: s.id,
              documentId: s.metadata?.documentId ?? s.id,
              documentName: s.metadata?.documentName ?? 'Unknown',
              page: s.metadata?.page,
              content: s.content,
              score: s.similarity ?? 0,
            })
          )
        : undefined;

      return {
        id: messageItem.id,
        role: validateRole(messageItem.role),
        content: messageItem.content,
        createdAt: messageItem.createdAt,
        citations,
      };
    });

    // Generate export based on format
    let content: string | Buffer;
    let contentType: string;
    let filename: string;

    const title = chat.title || 'Conversation';
    const workspaceName = undefined; // workspace relation not included

    switch (format) {
      case 'json':
        content = JSON.stringify(
          {
            title,
            workspace: workspaceName,
            exportedAt: new Date().toISOString(),
            messages,
          },
          null,
          2
        );
        contentType = 'application/json';
        filename = `${title.replace(/\s+/g, '_')}.json`;
        break;

      case 'markdown':
        content = generateMarkdown(title, workspaceName, messages, includeCitations);
        contentType = 'text/markdown';
        filename = `${title.replace(/\s+/g, '_')}.md`;
        break;

      case 'html':
        content = generateHTML(title, workspaceName, messages, includeCitations);
        contentType = 'text/html';
        filename = `${title.replace(/\s+/g, '_')}.html`;
        break;

      case 'pdf':
        // For PDF, we return JSON that the client will use to generate PDF
        // Actual PDF generation happens client-side with @react-pdf/renderer
        return NextResponse.json({
          success: true,
          data: {
            title,
            workspaceName,
            messages,
            options: {
              includeCitations,
              includeSources,
              citationStyle,
            },
          },
        });

      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    // Return file content
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to export conversation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to export conversation' }, { status: 500 });
  }
});

// Helper functions
function generateMarkdown(
  title: string,
  workspaceName: string | undefined,
  messages: ExportMessage[],
  includeCitations?: boolean
): string {
  let md = `---\n`;
  md += `title: ${title}\n`;
  if (workspaceName) md += `workspace: ${workspaceName}\n`;
  md += `date: ${new Date().toISOString()}\n`;
  md += `---\n\n`;
  md += `# ${title}\n\n`;

  messages
    .filter((m) => m.role !== 'system')
    .forEach((msg) => {
      const role = msg.role === 'user' ? '**You**' : '**Assistant**';
      const time = new Date(msg.createdAt).toLocaleString();
      md += `## ${role} • ${time}\n\n`;
      md += `${msg.content}\n\n`;

      if (includeCitations && msg.citations?.length) {
        md += `**Sources:**\n`;
        msg.citations.forEach((c: Citation) => {
          md += `- [${c.id.slice(0, 8)}] ${c.documentName}${c.page ? ` (p.${c.page})` : ''}\n`;
        });
        md += `\n`;
      }
    });

  return md;
}

function generateHTML(
  title: string,
  workspaceName: string | undefined,
  messages: ExportMessage[],
  includeCitations?: boolean
): string {
  const messagesHTML = messages
    .filter((m) => m.role !== 'system')
    .map(
      (msg) => `
    <div class="message ${msg.role}">
      <div class="message-header">
        <span class="role">${msg.role === 'user' ? 'You' : 'Assistant'}</span>
        <span class="time">${new Date(msg.createdAt).toLocaleString()}</span>
      </div>
      <div class="content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
      ${
        includeCitations && msg.citations?.length
          ? `
        <div class="citations">
          <p><strong>Sources:</strong></p>
          ${msg.citations
            .map(
              (c: Citation) =>
                `<span class="citation">[${c.id.slice(0, 8)}] ${c.documentName}</span>`
            )
            .join('')}
        </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #1e293b; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .message { margin: 20px 0; padding: 20px; border-radius: 12px; background: #f8fafc; }
    .message.user { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .message.assistant { border-left: 4px solid #10b981; }
    .message-header { display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center; }
    .role { font-weight: 600; color: #3b82f6; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .message.assistant .role { color: #10b981; }
    .time { color: #94a3b8; font-size: 12px; }
    .content { white-space: pre-wrap; }
    .citations { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .citation { display: inline-block; font-size: 12px; color: #64748b; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; margin: 4px 4px 0 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${workspaceName ? `<p><strong>Workspace:</strong> ${escapeHtml(workspaceName)}</p>` : ''}
  <p style="color: #64748b;">Exported on ${new Date().toLocaleDateString()}</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
  ${messagesHTML}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate message role
 */
function validateRole(role: string): 'user' | 'assistant' | 'system' {
  if (role === 'user' || role === 'assistant' || role === 'system') {
    return role;
  }
  return 'user';
}

/**
 * Parse sources from unknown value
 */
function parseSources(sources: unknown): SourceItem[] {
  if (typeof sources === 'string') {
    try {
      const parsed: unknown = JSON.parse(sources);
      if (Array.isArray(parsed)) {
        return parsed.filter(isSourceItem);
      }
    } catch (error: unknown) {
      logger.debug('Failed to parse sources JSON', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fall through to return empty array
    }
  } else if (Array.isArray(sources)) {
    return sources.filter(isSourceItem);
  }
  return [];
}

/**
 * Type guard for SourceItem
 */
function isSourceItem(item: unknown): item is SourceItem {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const source = item as Record<string, unknown>;
  return typeof source.id === 'string' && typeof source.content === 'string';
}
