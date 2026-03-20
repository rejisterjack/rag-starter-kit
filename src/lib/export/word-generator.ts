/**
 * Word Document Generator
 * Generates .docx files from conversations using the docx library
 */

import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

import type {
  ExportCitation,
  ExportConversation,
  ExportMessage,
  ExportOptions,
  ExportProgress,
} from './types';

// =============================================================================
// Types
// =============================================================================

export interface WordGenerationOptions extends ExportOptions {
  /** Document properties */
  title?: string;
  subject?: string;
  creator?: string;
  company?: string;
  /** Page margins in inches */
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// =============================================================================
// Word Generator Class
// =============================================================================

export class WordGenerator {
  private options: WordGenerationOptions;
  private onProgress?: (progress: ExportProgress) => void;

  constructor(
    options: WordGenerationOptions = { format: 'word' },
    onProgress?: (progress: ExportProgress) => void
  ) {
    this.options = {
      margins: {
        top: 1,
        right: 1,
        bottom: 1,
        left: 1,
      },
      ...options,
    };
    this.onProgress = onProgress;
  }

  /**
   * Generate Word document from a conversation
   */
  async generate(
    conversation: ExportConversation,
    citations: ExportCitation[] = []
  ): Promise<Buffer> {
    try {
      this.reportProgress({
        status: 'processing',
        progress: 10,
        currentStep: 'Building document structure...',
        processedItems: 0,
        totalItems: conversation.messages.length,
      });

      const doc = await this.buildDocument(conversation, citations);

      this.reportProgress({
        status: 'processing',
        progress: 80,
        currentStep: 'Packing document...',
        processedItems: conversation.messages.length,
        totalItems: conversation.messages.length,
      });

      const buffer = await Packer.toBuffer(doc);

      this.reportProgress({
        status: 'completed',
        progress: 100,
        currentStep: 'Complete',
        processedItems: conversation.messages.length,
        totalItems: conversation.messages.length,
      });

      return buffer;
    } catch (error) {
      this.reportProgress({
        status: 'failed',
        progress: 0,
        currentStep: 'Failed',
        processedItems: 0,
        totalItems: conversation.messages.length,
      });

      throw new WordGenerationError(
        `Failed to generate Word document: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate Word document from multiple conversations
   */
  async generateBulk(
    conversations: ExportConversation[],
    allCitations: ExportCitation[][] = []
  ): Promise<Buffer> {
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);

    this.reportProgress({
      status: 'processing',
      progress: 0,
      currentStep: 'Preparing bulk export...',
      processedItems: 0,
      totalItems: totalMessages,
    });

    // Create a merged document
    const sections = [];
    let processedCount = 0;

    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];
      const citations = allCitations[i] ?? [];

      sections.push(this.createSectionHeader(conversation.title, i + 1, conversations.length));

      const messageSections = this.createMessageSections(conversation.messages, citations);
      sections.push(...messageSections);

      if (i < conversations.length - 1) {
        sections.push(new Paragraph({ pageBreakBefore: true }));
      }

      processedCount += conversation.messages.length;

      this.reportProgress({
        status: 'processing',
        progress: Math.round((processedCount / totalMessages) * 70),
        currentStep: `Processing conversation ${i + 1} of ${conversations.length}...`,
        processedItems: processedCount,
        totalItems: totalMessages,
      });
    }

    const doc = new Document({
      title: `${conversations.length} Conversations Export`,
      creator: this.options.creator ?? 'RAG Starter Kit',
      subject: this.options.subject,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(this.options.margins?.top ?? 1),
                right: convertInchesToTwip(this.options.margins?.right ?? 1),
                bottom: convertInchesToTwip(this.options.margins?.bottom ?? 1),
                left: convertInchesToTwip(this.options.margins?.left ?? 1),
              },
            },
          },
          children: sections,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private async buildDocument(
    conversation: ExportConversation,
    citations: ExportCitation[]
  ): Promise<Document> {
    const sections: (Paragraph | TableOfContents | Table)[] = [];

    // Title
    sections.push(
      new Paragraph({
        text: conversation.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // Export info
    sections.push(
      new Paragraph({
        text: `Exported on ${new Date().toLocaleString()}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Metadata
    if (this.options.includeMetadata !== false) {
      sections.push(
        new Paragraph({
          text: 'Metadata',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const metadataTable = this.createMetadataTable(conversation);
      sections.push(metadataTable);

      sections.push(new Paragraph({ spacing: { after: 400 } }));
    }

    // Table of Contents
    if (this.options.includeTableOfContents) {
      sections.push(
        new Paragraph({
          text: 'Table of Contents',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      sections.push(
        new TableOfContents('Table of Contents', {
          hyperlink: true,
          headingStyleRange: '1-3',
        })
      );
    }

    // Messages
    sections.push(
      new Paragraph({
        text: 'Conversation',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        pageBreakBefore: this.options.includeTableOfContents,
      })
    );

    const messageSections = this.createMessageSections(conversation.messages, citations);
    sections.push(...messageSections);

    // Citations
    if (citations.length > 0 && this.options.includeCitations !== false) {
      sections.push(
        new Paragraph({
          text: 'References',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 600, after: 200 },
          pageBreakBefore: true,
        })
      );

      citations.forEach((citation, index) => {
        sections.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `[${index + 1}] `,
                bold: true,
              }),
              new TextRun({
                text: citation.documentName,
              }),
              ...(citation.page ? [new TextRun({ text: `, Page ${citation.page}` })] : []),
            ],
          })
        );
      });
    }

    return new Document({
      title: conversation.title,
      creator: this.options.creator ?? 'RAG Starter Kit',
      subject: this.options.subject ?? 'Conversation Export',
      description: `Exported conversation from ${conversation.createdAt.toLocaleString()}`,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(this.options.margins?.top ?? 1),
                right: convertInchesToTwip(this.options.margins?.right ?? 1),
                bottom: convertInchesToTwip(this.options.margins?.bottom ?? 1),
                left: convertInchesToTwip(this.options.margins?.left ?? 1),
              },
            },
          },
          headers: {
            default: this.createHeader(conversation),
          },
          footers: {
            default: this.createFooter(),
          },
          children: sections,
        },
      ],
    });
  }

  private createMetadataTable(conversation: ExportConversation): Table {
    const rows = [
      ['Conversation ID', conversation.id],
      ['Created', conversation.createdAt.toLocaleString()],
      ['Updated', conversation.updatedAt.toLocaleString()],
      ['Messages', conversation.messages.length.toString()],
      ...(conversation.userName ? [['Exported by', conversation.userName]] : []),
      ...(conversation.workspaceName ? [['Workspace', conversation.workspaceName]] : []),
    ];

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: label,
                        bold: true,
                      }),
                    ],
                  }),
                ],
                verticalAlign: VerticalAlign.CENTER,
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [new Paragraph(value)],
                verticalAlign: VerticalAlign.CENTER,
              }),
            ],
          })
      ),
    });
  }

  private createMessageSections(
    messages: ExportMessage[],
    citations: ExportCitation[]
  ): Paragraph[] {
    const sections: Paragraph[] = [];

    messages.forEach((message, index) => {
      const roleLabel = this.getRoleLabel(message.role);
      const roleColor = this.getRoleColor(message.role);

      // Message header
      sections.push(
        new Paragraph({
          spacing: { before: 300, after: 100 },
          border: {
            bottom: {
              color: roleColor,
              style: BorderStyle.SINGLE,
              size: 6,
              space: 4,
            },
          },
          children: [
            new TextRun({
              text: roleLabel,
              bold: true,
              color: roleColor,
              size: 24,
            }),
            new TextRun({
              text: `  ${message.createdAt.toLocaleString()}`,
              size: 20,
              color: '666666',
            }),
          ],
        })
      );

      // Message content
      const contentParagraphs = this.parseMessageContent(message.content);
      sections.push(...contentParagraphs);

      // Sources/Citations
      if (message.sources && message.sources.length > 0 && this.options.includeSources !== false) {
        sections.push(
          new Paragraph({
            text: 'Sources:',
            spacing: { before: 200, after: 100 },
            shading: { fill: 'F3F4F6' },
            children: [
              new TextRun({
                text: 'Sources:',
                bold: true,
                size: 20,
                color: '4B5563',
              }),
            ],
          })
        );

        message.sources.forEach((source, sourceIndex) => {
          const citationRef = this.findCitationForSource(source, citations);
          const citationNum = citationRef ? citations.indexOf(citationRef) + 1 : sourceIndex + 1;

          sections.push(
            new Paragraph({
              spacing: { before: 80, after: 80 },
              indent: { left: 360 },
              border: {
                left: {
                  color: '3B82F6',
                  style: BorderStyle.SINGLE,
                  size: 12,
                  space: 8,
                },
              },
              children: [
                new TextRun({
                  text: `[${citationNum}] ${source.documentName}`,
                  bold: true,
                  size: 20,
                }),
                ...(source.page
                  ? [
                      new TextRun({
                        text: ` (Page ${source.page})`,
                        size: 18,
                        italics: true,
                      }),
                    ]
                  : []),
              ],
            })
          );

          sections.push(
            new Paragraph({
              spacing: { after: 120 },
              indent: { left: 360 },
              children: [
                new TextRun({
                  text: `"${source.content.substring(0, 200)}${
                    source.content.length > 200 ? '...' : ''
                  }"`,
                  italics: true,
                  size: 18,
                  color: '6B7280',
                }),
              ],
            })
          );
        });
      }

      this.reportProgress({
        status: 'processing',
        progress: Math.round(((index + 1) / messages.length) * 70) + 10,
        currentStep: 'Formatting messages...',
        processedItems: index + 1,
        totalItems: messages.length,
      });
    });

    return sections;
  }

  private parseMessageContent(content: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const lines = content.split('\n');

    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          paragraphs.push(
            new Paragraph({
              spacing: { before: 120, after: 120 },
              shading: { fill: '1F2937' },
              children: [
                new TextRun({
                  text: codeBlockContent.join('\n'),
                  font: 'Courier New',
                  size: 18,
                  color: 'F3F4F6',
                }),
              ],
            })
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          // Start code block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Regular paragraph with inline formatting
      const children = this.parseInlineFormatting(line);

      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.slice(2),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.slice(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.slice(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        paragraphs.push(
          new Paragraph({
            text: line.slice(2),
            bullet: { level: 0 },
            spacing: { after: 80 },
          })
        );
      } else if (line.match(/^\d+\.\s/)) {
        const match = line.match(/^(\d+)\.\s(.+)$/);
        if (match) {
          paragraphs.push(
            new Paragraph({
              text: match[2],
              numbering: {
                reference: 'default-numbering',
                level: 0,
              },
              spacing: { after: 80 },
            })
          );
        }
      } else if (line.trim()) {
        paragraphs.push(
          new Paragraph({
            spacing: { after: 120 },
            children: children.length > 0 ? children : [new TextRun(line)],
          })
        );
      }
    }

    // Handle unclosed code block
    if (inCodeBlock && codeBlockContent.length > 0) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          shading: { fill: 'F3F4F6' },
          children: [
            new TextRun({
              text: codeBlockContent.join('\n'),
              font: 'Courier New',
              size: 18,
            }),
          ],
        })
      );
    }

    return paragraphs;
  }

  private parseInlineFormatting(line: string): TextRun[] {
    const runs: TextRun[] = [];
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**')) {
        runs.push(
          new TextRun({
            text: part.slice(2, -2),
            bold: true,
          })
        );
      } else if (part.startsWith('*') && part.endsWith('*')) {
        runs.push(
          new TextRun({
            text: part.slice(1, -1),
            italics: true,
          })
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        runs.push(
          new TextRun({
            text: part.slice(1, -1),
            font: 'Courier New',
            shading: { fill: 'F3F4F6' },
            size: 18,
          })
        );
      } else if (part) {
        runs.push(new TextRun(part));
      }
    }

    return runs;
  }

  private createSectionHeader(title: string, index: number, total: number): Paragraph {
    return new Paragraph({
      text: `${title} (${index} of ${total})`,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      border: {
        bottom: {
          color: '2563EB',
          style: BorderStyle.SINGLE,
          size: 12,
          space: 8,
        },
      },
    });
  }

  private createHeader(conversation: ExportConversation): Header {
    return new Header({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: conversation.title,
              bold: true,
              size: 18,
              color: '666666',
            }),
          ],
          border: {
            bottom: {
              color: 'E5E7EB',
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        }),
      ],
    });
  }

  private createFooter(): Footer {
    return new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Page',
              size: 18,
              color: '9CA3AF',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Exported on ${new Date().toLocaleDateString()}`,
              size: 16,
              color: '9CA3AF',
            }),
          ],
        }),
      ],
    });
  }

  private findCitationForSource(
    source: { documentId: string; page?: number },
    citations: ExportCitation[]
  ): ExportCitation | undefined {
    return citations.find((c) => c.documentId === source.documentId && c.page === source.page);
  }

  private getRoleLabel(role: string): string {
    switch (role) {
      case 'user':
        return 'User';
      case 'assistant':
        return 'Assistant';
      default:
        return 'System';
    }
  }

  private getRoleColor(role: string): string {
    switch (role) {
      case 'user':
        return '2563EB'; // Blue
      case 'assistant':
        return '7C3AED'; // Purple
      default:
        return '6B7280'; // Gray
    }
  }

  private reportProgress(progress: Omit<ExportProgress, 'jobId'>): void {
    if (this.onProgress) {
      this.onProgress({
        ...progress,
        jobId: 'word-generation',
      });
    }
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class WordGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordGenerationError';
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Generate Word document from a conversation
 */
export async function generateWord(
  conversation: ExportConversation,
  options: WordGenerationOptions = { format: 'word' },
  citations: ExportCitation[] = [],
  onProgress?: (progress: ExportProgress) => void
): Promise<Buffer> {
  const generator = new WordGenerator(options, onProgress);
  return generator.generate(conversation, citations);
}

/**
 * Generate Word document from multiple conversations
 */
export async function generateBulkWord(
  conversations: ExportConversation[],
  options: WordGenerationOptions = { format: 'word' },
  allCitations: ExportCitation[][] = [],
  onProgress?: (progress: ExportProgress) => void
): Promise<Buffer> {
  const generator = new WordGenerator(options, onProgress);
  return generator.generateBulk(conversations, allCitations);
}
