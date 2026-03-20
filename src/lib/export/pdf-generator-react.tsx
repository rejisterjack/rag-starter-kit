/**
 * PDF Generator for Conversation Export
 * Uses @react-pdf/renderer for PDF generation
 */

import { Document, Page, Text, View, StyleSheet, Font, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import React from 'react';
import { format } from 'date-fns';

// Register fonts (using standard fonts for now)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ],
});

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 30,
    borderBottom: '1pt solid #e5e5e5',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 5,
  },
  metadata: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 10,
  },
  message: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  messageUser: {
    backgroundColor: '#eff6ff',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageRole: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#3b82f6',
    textTransform: 'uppercase',
  },
  messageTime: {
    fontSize: 9,
    color: '#94a3b8',
  },
  messageContent: {
    fontSize: 11,
    color: '#1e293b',
  },
  citations: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1pt solid #e2e8f0',
  },
  citationTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 5,
  },
  citation: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
    color: '#94a3b8',
  },
  pageNumber: {
    fontSize: 9,
    color: '#94a3b8',
  },
  sources: {
    marginTop: 30,
    paddingTop: 20,
    borderTop: '2pt solid #e2e8f0',
  },
  sourcesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#0f172a',
  },
  source: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
  },
  sourceTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#334155',
  },
  sourceContent: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 4,
  },
  codeBlock: {
    fontFamily: 'Courier',
    fontSize: 9,
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    padding: 10,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 8,
  },
});

// Interfaces
export interface ExportMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  citations?: Array<{
    id: string;
    content: string;
    documentName: string;
    page?: number;
    similarity: number;
  }>;
}

export interface ExportOptions {
  title: string;
  workspaceName?: string;
  includeCitations?: boolean;
  includeSources?: boolean;
  citationStyle?: 'numbered' | 'footnote';
}

// PDF Document Component
interface ConversationPDFProps {
  messages: ExportMessage[];
  options: ExportOptions;
}

const ConversationPDF: React.FC<ConversationPDFProps> = ({ messages, options }) => {
  const { title, workspaceName, includeCitations } = options;
  
  // Collect all unique sources
  const allSources = new Map();
  messages.forEach((msg) => {
    msg.citations?.forEach((citation) => {
      if (!allSources.has(citation.id)) {
        allSources.set(citation.id, citation);
      }
    });
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {workspaceName && <Text style={styles.subtitle}>{workspaceName}</Text>}
          <Text style={styles.metadata}>
            Exported on {format(new Date(), 'MMMM d, yyyy')} • {messages.length} messages
          </Text>
        </View>

        {/* Messages */}
        {messages
          .filter((m) => m.role !== 'system')
          .map((message) => (
            <View
              key={message.id}
              style={[
                styles.message,
                message.role === 'user' && styles.messageUser,
              ]}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.messageRole}>
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </Text>
                <Text style={styles.messageTime}>
                  {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                </Text>
              </View>
              
              <Text style={styles.messageContent}>{message.content}</Text>
              
              {includeCitations && message.citations && message.citations.length > 0 && (
                <View style={styles.citations}>
                  <Text style={styles.citationTitle}>Sources:</Text>
                  {message.citations.map((citation) => (
                    <Text key={citation.id} style={styles.citation}>
                      [{citation.id.slice(0, 8)}] {citation.documentName}
                      {citation.page && `, p.${citation.page}`} •{' '}
                      {Math.round(citation.similarity * 100)}% match
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}

        {/* Sources Section */}
        {includeSources && allSources.size > 0 && (
          <View style={styles.sources}>
            <Text style={styles.sourcesTitle}>Referenced Sources</Text>
            {Array.from(allSources.values()).map((source) => (
              <View key={source.id} style={styles.source}>
                <Text style={styles.sourceTitle}>
                  [{source.id.slice(0, 8)}] {source.documentName}
                </Text>
                <Text style={styles.sourceContent}>
                  {source.content.slice(0, 200)}
                  {source.content.length > 200 ? '...' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

// Generator functions
export async function generateConversationPDF(
  messages: ExportMessage[],
  options: ExportOptions
): Promise<Blob> {
  return pdf(<ConversationPDF messages={messages} options={options} />).toBlob();
}

export function generateConversationPDFDownloadLink(
  messages: ExportMessage[],
  options: ExportOptions
): React.ReactElement {
  const filename = `${options.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  return (
    <PDFDownloadLink
      document={<ConversationPDF messages={messages} options={options} />}
      fileName={filename}
    >
      {({ loading }) => (loading ? 'Generating PDF...' : 'Download PDF')}
    </PDFDownloadLink>
  );
}

// Markdown generator (server-side compatible)
export function generateConversationMarkdown(
  messages: ExportMessage[],
  options: ExportOptions
): string {
  const { title, workspaceName, includeCitations } = options;
  
  let markdown = `---\ntitle: ${title}\n`;
  if (workspaceName) markdown += `workspace: ${workspaceName}\n`;
  markdown += `date: ${new Date().toISOString()}\n---\n\n`;
  
  markdown += `# ${title}\n\n`;
  
  messages
    .filter((m) => m.role !== 'system')
    .forEach((message) => {
      const role = message.role === 'user' ? '**You**' : '**Assistant**';
      const time = format(new Date(message.createdAt), 'MMM d, h:mm a');
      
      markdown += `## ${role} • ${time}\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (includeCitations && message.citations?.length) {
        markdown += `**Sources:**\n`;
        message.citations.forEach((c) => {
          markdown += `- [${c.id.slice(0, 8)}] ${c.documentName}${c.page ? ` (p.${c.page})` : ''}\n`;
        });
        markdown += `\n`;
      }
    });
  
  return markdown;
}

// HTML generator
export function generateConversationHTML(
  messages: ExportMessage[],
  options: ExportOptions
): string {
  const { title, workspaceName, includeCitations } = options;
  
  const messagesHTML = messages
    .filter((m) => m.role !== 'system')
    .map(
      (message) => `
    <div class="message ${message.role}">
      <div class="message-header">
        <span class="role">${message.role === 'user' ? 'You' : 'Assistant'}</span>
        <span class="time">${format(new Date(message.createdAt), 'MMM d, h:mm a')}</span>
      </div>
      <div class="content">${escapeHtml(message.content).replace(/\n/g, '<br>')}</div>
      ${
        includeCitations && message.citations?.length
          ? `
        <div class="citations">
          <p><strong>Sources:</strong></p>
          ${message.citations
            .map(
              (c) => `
            <span class="citation">[${c.id.slice(0, 8)}] ${c.documentName}</span>
          `
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
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; background: #f8fafc; }
    .message.user { background: #eff6ff; }
    .message-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .role { font-weight: 600; color: #3b82f6; text-transform: uppercase; font-size: 12px; }
    .time { color: #94a3b8; font-size: 12px; }
    .content { line-height: 1.6; }
    .citations { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .citation { font-size: 12px; color: #64748b; margin-right: 10px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${workspaceName ? `<p>Workspace: ${escapeHtml(workspaceName)}</p>` : ''}
  <p>Exported on ${format(new Date(), 'MMMM d, yyyy')}</p>
  ${messagesHTML}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  // Server-side fallback
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default {
  generateConversationPDF,
  generateConversationPDFDownloadLink,
  generateConversationMarkdown,
  generateConversationHTML,
};
