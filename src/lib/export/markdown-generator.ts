/**
 * Markdown Generator
 * Generates Markdown files from conversations
 */

import type {
  CitationStyle,
  ExportCitation,
  ExportConversation,
  ExportMessage,
  ExportOptions,
  ExportProgress,
} from './types';

// =============================================================================
// Types
// =============================================================================

export interface MarkdownGenerationOptions extends ExportOptions {
  /** Include YAML frontmatter */
  frontmatter?: boolean;
  /** Include table of contents */
  toc?: boolean;
  /** GFM (GitHub Flavored Markdown) features */
  gfm?: boolean;
  /** Enable mermaid diagrams */
  mermaid?: boolean;
}

// =============================================================================
// Markdown Generator Class
// =============================================================================

export class MarkdownGenerator {
  private options: MarkdownGenerationOptions;
  private onProgress?: (progress: ExportProgress) => void;

  constructor(
    options: MarkdownGenerationOptions = { format: 'markdown' },
    onProgress?: (progress: ExportProgress) => void
  ) {
    this.options = {
      frontmatter: true,
      toc: false,
      gfm: true,
      ...options,
    };
    this.onProgress = onProgress;
  }

  /**
   * Generate Markdown from a conversation
   */
  async generate(
    conversation: ExportConversation,
    citations: ExportCitation[] = []
  ): Promise<string> {
    try {
      this.reportProgress({
        status: 'processing',
        progress: 10,
        currentStep: 'Building Markdown content...',
        processedItems: 0,
        totalItems: conversation.messages.length,
      });

      const lines: string[] = [];

      // YAML Frontmatter
      if (this.options.frontmatter) {
        lines.push(...this.generateFrontmatter(conversation));
      }

      // Table of Contents
      if (this.options.toc) {
        lines.push(...this.generateTableOfContents(conversation));
      }

      // Title
      lines.push(`# ${conversation.title}`, '');

      // Metadata section
      if (this.options.includeMetadata !== false) {
        lines.push(...this.generateMetadataSection(conversation));
      }

      // Messages
      lines.push('## Conversation', '');

      for (let i = 0; i < conversation.messages.length; i++) {
        const message = conversation.messages[i];
        lines.push(...this.generateMessageSection(message, citations, i));

        this.reportProgress({
          status: 'processing',
          progress: Math.round(((i + 1) / conversation.messages.length) * 80) + 10,
          currentStep: 'Formatting messages...',
          processedItems: i + 1,
          totalItems: conversation.messages.length,
        });
      }

      // Citations
      if (citations.length > 0 && this.options.includeCitations !== false) {
        lines.push(...this.generateCitationsSection(citations));
      }

      this.reportProgress({
        status: 'completed',
        progress: 100,
        currentStep: 'Complete',
        processedItems: conversation.messages.length,
        totalItems: conversation.messages.length,
      });

      return lines.join('\n');
    } catch (error) {
      this.reportProgress({
        status: 'failed',
        progress: 0,
        currentStep: 'Failed',
        processedItems: 0,
        totalItems: conversation.messages.length,
      });

      throw new MarkdownGenerationError(
        `Failed to generate Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate Markdown from multiple conversations
   */
  async generateBulk(
    conversations: ExportConversation[],
    allCitations: ExportCitation[][] = []
  ): Promise<string> {
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);

    this.reportProgress({
      status: 'processing',
      progress: 0,
      currentStep: 'Preparing bulk export...',
      processedItems: 0,
      totalItems: totalMessages,
    });

    const sections: string[] = [];

    // Main title
    sections.push(`# Bulk Export: ${conversations.length} Conversations`, '');
    sections.push(`**Exported:** ${new Date().toLocaleString()}`, '');
    sections.push('---', '');

    let processedCount = 0;

    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];
      const citations = allCitations[i] ?? [];

      sections.push(`## Conversation ${i + 1}: ${conversation.title}`, '');
      sections.push(`*ID: ${conversation.id}*`, '');
      sections.push(`*Created: ${conversation.createdAt.toLocaleString()}*`, '');
      sections.push('');

      for (const message of conversation.messages) {
        sections.push(...this.generateMessageSection(message, citations));
        processedCount++;
      }

      // Add citations for this conversation
      if (citations.length > 0) {
        sections.push('### References', '');
        citations.forEach((citation, index) => {
          sections.push(this.formatCitation(citation, index, 'footnotes'));
        });
        sections.push('');
      }

      if (i < conversations.length - 1) {
        sections.push('---', '');
      }

      this.reportProgress({
        status: 'processing',
        progress: Math.round((processedCount / totalMessages) * 90),
        currentStep: `Processing conversation ${i + 1} of ${conversations.length}...`,
        processedItems: processedCount,
        totalItems: totalMessages,
      });
    }

    this.reportProgress({
      status: 'completed',
      progress: 100,
      currentStep: 'Complete',
      processedItems: totalMessages,
      totalItems: totalMessages,
    });

    return sections.join('\n');
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private generateFrontmatter(conversation: ExportConversation): string[] {
    const frontmatter: Record<string, unknown> = {
      title: conversation.title,
      id: conversation.id,
      created: conversation.createdAt.toISOString(),
      updated: conversation.updatedAt.toISOString(),
      messageCount: conversation.messages.length,
      exportedAt: new Date().toISOString(),
      format: 'markdown',
    };

    if (conversation.userName) {
      frontmatter.exportedBy = conversation.userName;
    }

    if (conversation.workspaceName) {
      frontmatter.workspace = conversation.workspaceName;
    }

    const lines: string[] = ['---'];
    for (const [key, value] of Object.entries(frontmatter)) {
      lines.push(`${key}: ${value}`);
    }
    lines.push('---', '');

    return lines;
  }

  private generateTableOfContents(conversation: ExportConversation): string[] {
    const lines: string[] = ['## Table of Contents', ''];

    conversation.messages.forEach((message, index) => {
      const role = this.getRoleLabel(message.role);
      const timestamp = this.formatDate(message.createdAt);
      lines.push(`${index + 1}. [${role} - ${timestamp}](#message-${index + 1})`);
    });

    lines.push('');
    return lines;
  }

  private generateMetadataSection(conversation: ExportConversation): string[] {
    const lines: string[] = ['## Metadata', ''];

    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **Conversation ID** | ${conversation.id} |`);
    lines.push(`| **Created** | ${this.formatDate(conversation.createdAt)} |`);
    lines.push(`| **Updated** | ${this.formatDate(conversation.updatedAt)} |`);
    lines.push(`| **Messages** | ${conversation.messages.length} |`);

    if (conversation.userName) {
      lines.push(`| **Exported by** | ${conversation.userName} |`);
    }

    if (conversation.workspaceName) {
      lines.push(`| **Workspace** | ${conversation.workspaceName} |`);
    }

    lines.push('');
    return lines;
  }

  private generateMessageSection(
    message: ExportMessage,
    citations: ExportCitation[],
    index?: number
  ): string[] {
    const lines: string[] = [];
    const role = this.getRoleLabel(message.role);
    const timestamp = this.formatDate(message.createdAt);

    // Message header with anchor
    if (index !== undefined) {
      lines.push(`<a id="message-${index + 1}"></a>`);
    }

    lines.push(`### ${role} (${timestamp})`, '');

    // Message content with preserved formatting
    const formattedContent = this.formatMessageContent(message.content);
    lines.push(formattedContent);
    lines.push('');

    // Sources section
    if (message.sources && message.sources.length > 0 && this.options.includeSources !== false) {
      lines.push('**Sources:**', '');

      message.sources.forEach((source, sourceIndex) => {
        const citationRef = this.findCitationForSource(source, citations);
        const citationNum = citationRef ? citations.indexOf(citationRef) + 1 : sourceIndex + 1;

        lines.push(`${sourceIndex + 1}. **${source.documentName}** [${citationNum}]`);
        if (source.page) {
          lines.push(`   - Page: ${source.page}`);
        }
        if (source.similarity !== undefined) {
          lines.push(`   - Relevance: ${(source.similarity * 100).toFixed(1)}%`);
        }

        // Truncate content for display
        const content = source.content.slice(0, 200);
        const truncated = source.content.length > 200 ? `${content}...` : content;
        lines.push(`   - *"${truncated.replace(/\n/g, ' ')}"*`);
        lines.push('');
      });
    }

    lines.push('---', '');
    return lines;
  }

  private generateCitationsSection(citations: ExportCitation[]): string[] {
    const lines: string[] = [];
    const style = this.options.citationStyle ?? 'footnotes';

    lines.push('## References', '');

    citations.forEach((citation, index) => {
      lines.push(this.formatCitation(citation, index, style));
    });

    lines.push('');
    return lines;
  }

  private formatCitation(citation: ExportCitation, index: number, style: CitationStyle): string {
    const num = index + 1;

    switch (style) {
      case 'harvard':
        return `${num}. ${citation.documentName}${citation.page ? `, p. ${citation.page}` : ''}`;

      case 'apa':
        return `${num}. ${citation.documentName}${citation.page ? `, p. ${citation.page}` : ''}.`;

      case 'footnotes':
      case 'endnotes':
      default:
        return `[^${num}]: ${citation.documentName}${citation.page ? `, Page ${citation.page}` : ''}`;
    }
  }

  private formatMessageContent(content: string): string {
    // The content is already in markdown format from the conversation
    // We just need to ensure proper line endings and escaping
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
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

  private formatDate(date: Date): string {
    switch (this.options.dateFormat) {
      case 'iso':
        return date.toISOString();
      case 'relative':
        return this.getRelativeTime(date);
      case 'locale':
      default:
        return date.toLocaleString();
    }
  }

  private getRelativeTime(date: Date): string {
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

  private reportProgress(progress: Omit<ExportProgress, 'jobId'>): void {
    if (this.onProgress) {
      this.onProgress({
        ...progress,
        jobId: 'markdown-generation',
      });
    }
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class MarkdownGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownGenerationError';
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Generate Markdown from a conversation
 */
export async function generateMarkdown(
  conversation: ExportConversation,
  options: MarkdownGenerationOptions = { format: 'markdown' },
  citations: ExportCitation[] = [],
  onProgress?: (progress: ExportProgress) => void
): Promise<string> {
  const generator = new MarkdownGenerator(options, onProgress);
  return generator.generate(conversation, citations);
}

/**
 * Generate Markdown from multiple conversations
 */
export async function generateBulkMarkdown(
  conversations: ExportConversation[],
  options: MarkdownGenerationOptions = { format: 'markdown' },
  allCitations: ExportCitation[][] = [],
  onProgress?: (progress: ExportProgress) => void
): Promise<string> {
  const generator = new MarkdownGenerator(options, onProgress);
  return generator.generateBulk(conversations, allCitations);
}

/**
 * Convert citations to Markdown footnotes format
 */
export function citationsToFootnotes(citations: ExportCitation[]): string {
  if (citations.length === 0) return '';

  const lines = citations.map((citation, index) => {
    const pageInfo = citation.page ? `, Page ${citation.page}` : '';
    return `[^${index + 1}]: ${citation.documentName}${pageInfo}`;
  });

  return '\n\n' + lines.join('\n') + '\n';
}

/**
 * Extract citations from content and replace with footnote references
 */
export function convertCitationsToFootnotes(content: string, citations: ExportCitation[]): string {
  let result = content;

  // Replace [1], [2], etc. with [^1], [^2], etc.
  citations.forEach((_, index) => {
    const pattern = new RegExp(`\\[${index + 1}\\](?!\\^)`, 'g');
    result = result.replace(pattern, `[^${index + 1}]`);
  });

  return result + citationsToFootnotes(citations);
}
