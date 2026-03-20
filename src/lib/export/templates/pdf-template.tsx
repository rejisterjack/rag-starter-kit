/**
 * PDF Export Template
 * React-pdf template for professional PDF generation
 */

'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';

// Extract types from @react-pdf/renderer components
type PDFPageProps = React.ComponentProps<typeof Page>;
type PDFPageSize = PDFPageProps['size'];

import type { ExportConversation, ExportOptions, ExportCitation } from '../types';

// =============================================================================
// Font Registration
// =============================================================================

// Register fonts for RTL support
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ],
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.6,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    borderBottomStyle: 'solid',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
  },
  workspaceName: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metadata: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metadataLabel: {
    width: 100,
    fontWeight: 'bold',
    color: '#444',
  },
  metadataValue: {
    flex: 1,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  message: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
  },
  messageUser: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  messageAssistant: {
    backgroundColor: '#faf5ff',
    borderLeftWidth: 4,
    borderLeftColor: '#a855f7',
  },
  messageSystem: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 4,
    borderLeftColor: '#9ca3af',
    fontStyle: 'italic',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageRole: {
    fontWeight: 'bold',
    fontSize: 11,
  },
  messageRoleUser: {
    color: '#2563eb',
  },
  messageRoleAssistant: {
    color: '#7c3aed',
  },
  messageTimestamp: {
    fontSize: 9,
    color: '#9ca3af',
  },
  messageContent: {
    color: '#374151',
    lineHeight: 1.6,
  },
  codeBlock: {
    backgroundColor: '#1f2937',
    color: '#f3f4f6',
    padding: 10,
    borderRadius: 4,
    fontFamily: 'Courier',
    fontSize: 9,
    marginVertical: 8,
  },
  inlineCode: {
    backgroundColor: '#f3f4f6',
    padding: '2 4',
    borderRadius: 3,
    fontFamily: 'Courier',
    fontSize: 9,
  },
  sources: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sourcesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 8,
  },
  source: {
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sourceNumber: {
    width: 20,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  sourceName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
  },
  sourceMeta: {
    fontSize: 8,
    color: '#9ca3af',
  },
  sourceContent: {
    fontSize: 8,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  citations: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  citationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  citation: {
    marginBottom: 8,
    fontSize: 10,
  },
  citationId: {
    fontWeight: 'bold',
    color: '#2563eb',
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: 60,
    color: 'rgba(200, 200, 200, 0.3)',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  pageNumber: {
    fontSize: 8,
    color: '#9ca3af',
  },
  rtl: {
    direction: 'rtl',
    textAlign: 'right',
  },
  toc: {
    marginBottom: 20,
  },
  tocTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tocItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  tocText: {
    flex: 1,
  },
  tocPage: {
    width: 30,
    textAlign: 'right',
  },
});

// =============================================================================
// Helper Components
// =============================================================================

interface MessageContentProps {
  content: string;
  isRTL?: boolean;
}

function MessageContent({ content, isRTL }: MessageContentProps) {
  // Split content by code blocks
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return (
    <View style={isRTL ? styles.rtl : undefined}>
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          // Code block
          const code = part.replace(/```(\w+)?\n?/, '').replace(/```$/, '');
          return (
            <View key={index} style={styles.codeBlock}>
              <Text>{code}</Text>
            </View>
          );
        } else if (part.startsWith('`') && part.endsWith('`')) {
          // Inline code
          return (
            <Text key={index} style={styles.inlineCode}>
              {part.slice(1, -1)}
            </Text>
          );
        } else {
          // Regular text with bold formatting
          const textWithBold = part
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1');
          return <Text key={index}>{textWithBold}</Text>;
        }
      })}
    </View>
  );
}

// =============================================================================
// Main Template Component
// =============================================================================

interface PDFTemplateProps {
  conversation: ExportConversation;
  options: ExportOptions;
  citations: ExportCitation[];
}

export function PDFTemplate({ conversation, options, citations }: PDFTemplateProps) {
  const {
    includeMetadata = true,
    includeSources = true,
    watermark = false,
    includeTableOfContents = false,
    logoUrl,
    workspaceName,
    dateFormat = 'locale',
  } = options;

  const isRTL = options.language === 'ar' || options.language === 'he';

  const formatDate = (date: Date): string => {
    switch (dateFormat) {
      case 'iso':
        return date.toISOString();
      case 'relative':
        const diff = Date.now() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return days === 0 ? 'Today' : `${days} days ago`;
      case 'locale':
      default:
        return date.toLocaleString();
    }
  };

  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return styles.messageUser;
      case 'assistant':
        return styles.messageAssistant;
      default:
        return styles.messageSystem;
    }
  };

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'user':
        return styles.messageRoleUser;
      case 'assistant':
        return styles.messageRoleAssistant;
      default:
        return {};
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'user':
        return 'User';
      case 'assistant':
        return 'Assistant';
      default:
        return 'System';
    }
  };

  return (
    <Document>
      {/* Cover Page */}
      <Page size={(options.pageSize ?? 'A4') as PDFPageSize} style={styles.page as PDFPageProps['style']}>
        {watermark && (
          <View style={styles.watermark}>
            <Text>CONFIDENTIAL</Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.headerTop}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            {workspaceName && <Text style={styles.workspaceName}>{workspaceName}</Text>}
          </View>
          <Text style={styles.title}>{conversation.title}</Text>
          <Text style={styles.subtitle}>
            Exported on {formatDate(new Date())}
          </Text>
        </View>

        {includeMetadata && (
          <View style={styles.metadata}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Conversation ID:</Text>
              <Text style={styles.metadataValue}>{conversation.id}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Created:</Text>
              <Text style={styles.metadataValue}>{formatDate(conversation.createdAt)}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Updated:</Text>
              <Text style={styles.metadataValue}>{formatDate(conversation.updatedAt)}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Messages:</Text>
              <Text style={styles.metadataValue}>{conversation.messages.length}</Text>
            </View>
            {conversation.userName && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Exported by:</Text>
                <Text style={styles.metadataValue}>{conversation.userName}</Text>
              </View>
            )}
          </View>
        )}

        {includeTableOfContents && (
          <View style={styles.toc}>
            <Text style={styles.tocTitle}>Table of Contents</Text>
            {conversation.messages.map((msg, index) => (
              <View key={msg.id} style={styles.tocItem}>
                <Text style={styles.tocText}>
                  {index + 1}. {getRoleLabel(msg.role)} - {formatDate(msg.createdAt)}
                </Text>
                <Text style={styles.tocPage}>{index + 1}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Conversation</Text>
      </Page>

      {/* Message Pages */}
      {conversation.messages.map((message, index) => (
        <Page
          key={message.id}
          size={(options.pageSize ?? 'A4') as PDFPageSize}
          style={[styles.page, isRTL ? styles.rtl : undefined] as PDFPageProps['style']}
        >
          <View style={[styles.message, getMessageStyle(message.role)]}>
            <View style={styles.messageHeader}>
              <Text style={[styles.messageRole, getRoleStyle(message.role)]}>
                {getRoleLabel(message.role)}
              </Text>
              <Text style={styles.messageTimestamp}>{formatDate(message.createdAt)}</Text>
            </View>

            <View style={styles.messageContent}>
              <MessageContent content={message.content} isRTL={isRTL} />
            </View>

            {includeSources && message.sources && message.sources.length > 0 && (
              <View style={styles.sources}>
                <Text style={styles.sourcesTitle}>Sources</Text>
                {message.sources.map((source, sourceIndex) => (
                  <View key={source.id} style={styles.source}>
                    <View style={styles.sourceHeader}>
                      <Text style={styles.sourceNumber}>[{sourceIndex + 1}]</Text>
                      <Text style={styles.sourceName}>{source.documentName}</Text>
                    </View>
                    {source.page && (
                      <Text style={styles.sourceMeta}>Page {source.page}</Text>
                    )}
                    <Text style={styles.sourceContent}>
                      &ldquo;{source.content.substring(0, 150)}
                      {source.content.length > 150 ? '...' : ''}&rdquo;
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Citations Section on last page */}
          {index === conversation.messages.length - 1 && citations.length > 0 && (
            <View style={styles.citations}>
              <Text style={styles.citationTitle}>References</Text>
              {citations.map((citation, citationIndex) => (
                <View key={citation.id} style={styles.citation}>
                  <Text>
                    <Text style={styles.citationId}>[{citationIndex + 1}] </Text>
                    {citation.documentName}
                    {citation.page && `, Page ${citation.page}`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.footer} fixed>
            <Text>{conversation.title}</Text>
            <Text style={styles.pageNumber}>
              Page {index + 1} of {conversation.messages.length}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

export default PDFTemplate;
