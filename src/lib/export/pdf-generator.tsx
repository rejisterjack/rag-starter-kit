/**
 * PDF Generator
 * Generates PDF files from conversations using @react-pdf/renderer
 */

import {
  Page,
  Document as PDFDocument,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReactElement } from 'react';

import type { ExportCitation, ExportConversation, ExportOptions, ExportProgress } from './types';

// Extract types from @react-pdf/renderer components
type PDFPageProps = React.ComponentProps<typeof Page>;
type PDFPageSize = PDFPageProps['size'];

// =============================================================================
// Types
// =============================================================================

export interface PDFGenerationOptions extends Omit<ExportOptions, 'pageSize'> {
  /** PDF page size - using @react-pdf/renderer Page size type */
  pageSize?: Extract<PDFPageSize, string>;
  /** Page margins in mm */
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Include header on each page */
  includeHeader?: boolean;
  /** Include footer with page numbers */
  includeFooter?: boolean;
  /** Font size */
  fontSize?: number;
  /** Line height */
  lineHeight?: number;
}

export interface PDFGenerationProgress {
  progress: number;
  currentStep: string;
  processedItems: number;
  totalItems: number;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 50,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1px solid #000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  messageContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    marginBottom: 5,
    borderBottom: '1px solid #eee',
    paddingBottom: 5,
  },
  role: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#333',
  },
  timestamp: {
    fontSize: 9,
    color: '#999',
    marginLeft: 'auto',
  },
  content: {
    fontSize: 11,
    lineHeight: 1.5,
    color: '#333',
  },
  citationsSection: {
    marginTop: 30,
    borderTop: '1px solid #000',
    paddingTop: 15,
  },
  citationsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  citation: {
    fontSize: 10,
    marginBottom: 5,
    color: '#555',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 9,
    color: '#999',
    borderTop: '1px solid #eee',
    paddingTop: 10,
  },
});

// =============================================================================
// PDF Components
// =============================================================================

interface ConversationPDFProps {
  conversation: ExportConversation;
  citations: ExportCitation[];
  options: PDFGenerationOptions;
}

function ConversationPDF({ conversation, citations, options }: ConversationPDFProps): ReactElement {
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  return (
    <PDFDocument>
      <Page
        size={(options.pageSize || 'A4') as PDFPageSize}
        style={styles.page as PDFPageProps['style']}
      >
        {/* Header */}
        {options.includeHeader !== false && (
          <View style={styles.header}>
            <Text style={styles.title}>{conversation.title}</Text>
            <Text style={styles.subtitle}>ID: {conversation.id}</Text>
            <Text style={styles.subtitle}>Created: {formatDate(conversation.createdAt)}</Text>
            <Text style={styles.subtitle}>Messages: {conversation.messages.length}</Text>
          </View>
        )}

        {/* Messages */}
        <View style={styles.section}>
          {conversation.messages.map((message, index) => (
            <View key={index} style={styles.messageContainer}>
              <View style={styles.messageHeader}>
                <Text style={styles.role}>{message.role}</Text>
                <Text style={styles.timestamp}>{formatDate(message.createdAt)}</Text>
              </View>
              <Text style={styles.content}>{message.content}</Text>
            </View>
          ))}
        </View>

        {/* Citations */}
        {citations.length > 0 && (
          <View style={styles.citationsSection}>
            <Text style={styles.citationsTitle}>Citations</Text>
            {citations.map((citation, index) => (
              <Text key={index} style={styles.citation}>
                [{index + 1}] {citation.documentName}
                {citation.page ? `, Page ${citation.page}` : ''}
              </Text>
            ))}
          </View>
        )}

        {/* Footer */}
        {options.includeFooter !== false && (
          <Text style={styles.footer}>
            Exported from RAG Starter Kit • {new Date().toLocaleDateString()}
          </Text>
        )}
      </Page>
    </PDFDocument>
  );
}

// =============================================================================
// PDF Generator Class
// =============================================================================

export class PDFGenerator {
  private options: PDFGenerationOptions;
  private onProgress?: (progress: ExportProgress) => void;

  constructor(
    options: PDFGenerationOptions = { format: 'pdf' },
    onProgress?: (progress: ExportProgress) => void
  ) {
    this.options = options;
    this.onProgress = onProgress;
  }

  /**
   * Generate PDF from a conversation
   */
  async generate(
    conversation: ExportConversation,
    citations: ExportCitation[] = []
  ): Promise<Buffer> {
    this.reportProgress({
      progress: 0,
      currentStep: 'Initializing PDF generation...',
      processedItems: 0,
      totalItems: conversation.messages.length,
    });

    try {
      this.reportProgress({
        progress: 30,
        currentStep: 'Building PDF content...',
        processedItems: Math.floor(conversation.messages.length / 2),
        totalItems: conversation.messages.length,
      });

      // Create PDF document
      const pdfElement = (
        <ConversationPDF conversation={conversation} citations={citations} options={this.options} />
      );

      this.reportProgress({
        progress: 60,
        currentStep: 'Rendering PDF...',
        processedItems: Math.floor(conversation.messages.length * 0.75),
        totalItems: conversation.messages.length,
      });

      // Render to buffer
      const buffer = await renderToBuffer(pdfElement);

      this.reportProgress({
        progress: 100,
        currentStep: 'PDF generation complete',
        processedItems: conversation.messages.length,
        totalItems: conversation.messages.length,
      });

      return buffer;
    } catch (error) {
      throw new PDFGenerationError(
        `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private reportProgress(progress: Omit<PDFGenerationProgress, 'jobId'>): void {
    if (this.onProgress) {
      this.onProgress({
        ...progress,
        jobId: 'pdf-generation',
        status: 'processing',
      });
    }
  }
}

// =============================================================================
// Streaming PDF Generator (Stub for future implementation)
// =============================================================================

export class StreamingPDFGenerator {
  // Would be used for large documents to stream chunks
  // Implementation would use react-pdf's PDFDownloadLink or streaming APIs
}

// =============================================================================
// Error Class
// =============================================================================

export class PDFGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFGenerationError';
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Generate PDF from a conversation
 */
export async function generatePDF(
  conversation: ExportConversation,
  options: PDFGenerationOptions = { format: 'pdf' },
  citations: ExportCitation[] = [],
  onProgress?: (progress: ExportProgress) => void
): Promise<Buffer> {
  const generator = new PDFGenerator(options, onProgress);
  return generator.generate(conversation, citations);
}

/**
 * Generate PDF from multiple conversations
 */
export async function generateBulkPDF(
  conversations: ExportConversation[],
  options: PDFGenerationOptions = { format: 'pdf' },
  allCitations: ExportCitation[][] = [],
  onProgress?: (progress: ExportProgress) => void
): Promise<Buffer> {
  // For bulk export, create a combined PDF with multiple pages
  const CombinedPDF = (): ReactElement => (
    <PDFDocument>
      {conversations.map((conversation, convIndex) => (
        <Page
          key={convIndex}
          size={(options.pageSize || 'A4') as PDFPageSize}
          style={styles.page as PDFPageProps['style']}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{conversation.title}</Text>
            <Text style={styles.subtitle}>ID: {conversation.id}</Text>
            <Text style={styles.subtitle}>
              Created: {new Date(conversation.createdAt).toLocaleString()}
            </Text>
          </View>
          <View style={styles.section}>
            {conversation.messages.map((message, msgIndex) => (
              <View key={msgIndex} style={styles.messageContainer}>
                <View style={styles.messageHeader}>
                  <Text style={styles.role}>{message.role}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(message.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.content}>{message.content}</Text>
              </View>
            ))}
          </View>
          {allCitations[convIndex]?.length > 0 && (
            <View style={styles.citationsSection}>
              <Text style={styles.citationsTitle}>Citations</Text>
              {allCitations[convIndex].map((citation, idx) => (
                <Text key={idx} style={styles.citation}>
                  [{idx + 1}] {citation.documentName}
                  {citation.page ? `, Page ${citation.page}` : ''}
                </Text>
              ))}
            </View>
          )}
        </Page>
      ))}
    </PDFDocument>
  );

  if (onProgress) {
    onProgress({
      jobId: 'pdf-bulk-generation',
      status: 'processing',
      progress: 0,
      currentStep: `Processing ${conversations.length} conversations...`,
      processedItems: 0,
      totalItems: conversations.length,
    });
  }

  const buffer = await renderToBuffer(<CombinedPDF />);

  if (onProgress) {
    onProgress({
      jobId: 'pdf-bulk-generation',
      status: 'completed',
      progress: 100,
      currentStep: `Generated PDF with ${conversations.length} conversations`,
      processedItems: conversations.length,
      totalItems: conversations.length,
    });
  }

  return buffer;
}

/**
 * Quick PDF export
 */
export async function quickPDF(
  conversation: ExportConversation,
  citations: ExportCitation[] = []
): Promise<Buffer> {
  const generator = new PDFGenerator({ format: 'pdf' });
  return generator.generate(conversation, citations);
}
