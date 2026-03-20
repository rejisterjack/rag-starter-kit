/**
 * Export API Route
 * Handles conversation export to various formats
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';

export async function POST(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse request
    let body: unknown;
    try {
      body = await req.json();
    } catch {
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
        OR: [
          { userId },
          { workspaceId: workspaceId ?? '' },
        ],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check export permission for workspace chats
    if (chat.workspaceId && chat.userId !== userId) {
      const canExport = await checkPermission(userId, chat.workspaceId, Permission.READ_DOCUMENTS);
      if (!canExport) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
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
    const messages = chat.messages.map((msg: typeof chat.messages[0]) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      createdAt: msg.createdAt,
      citations: includeCitations ? (msg.sources as Array<{id: string; content: string; metadata?: {documentName?: string; page?: number}; similarity?: number}> | null)?.map((s: {id: string; content: string; metadata?: {documentName?: string; page?: number}; similarity?: number}) => ({
        id: s.id,
        content: s.content,
        documentName: s.metadata?.documentName || 'Unknown',
        page: s.metadata?.page,
        similarity: s.similarity ?? 0,
      })) : undefined,
    }));

    // Generate export based on format
    let content: string | Buffer;
    let contentType: string;
    let filename: string;

    const title = chat.title || 'Conversation';
    const workspaceName = undefined; // workspace relation not included

    switch (format) {
      case 'json':
        content = JSON.stringify({
          title,
          workspace: workspaceName,
          exportedAt: new Date().toISOString(),
          messages,
        }, null, 2);
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
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        );
    }

    // Return file content
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export conversation' },
      { status: 500 }
    );
  }
}

// Helper functions
function generateMarkdown(
  title: string,
  workspaceName: string | undefined,
  messages: any[],
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
        msg.citations.forEach((c: any) => {
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
  messages: any[],
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
            .map((c: any) => `<span class="citation">[${c.id.slice(0, 8)}] ${c.documentName}</span>`)
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
