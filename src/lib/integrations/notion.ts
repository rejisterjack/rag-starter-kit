/**
 * Notion Integration
 * Import pages and databases from Notion
 */

import { Client } from '@notionhq/client';

export class NotionIntegration {
  private client: Client;

  constructor(accessToken: string) {
    this.client = new Client({ auth: accessToken });
  }

  /**
   * List available pages
   */
  async listPages() {
    const response = await this.client.search({
      filter: { value: 'page', property: 'object' },
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: page.properties?.title?.title?.[0]?.plain_text || 'Untitled',
      url: page.url,
      lastEdited: page.last_edited_time,
    }));
  }

  /**
   * Get page content as markdown
   */
  async getPageContent(pageId: string): Promise<string> {
    const blocks = await this.client.blocks.children.list({
      block_id: pageId,
    });

    let markdown = '';

    for (const block of blocks.results) {
      markdown += this.blockToMarkdown(block as any);
    }

    return markdown;
  }

  /**
   * Convert Notion block to Markdown
   */
  private blockToMarkdown(block: any): string {
    const type = block.type;

    switch (type) {
      case 'paragraph':
        return this.richTextToMarkdown(block.paragraph.rich_text) + '\n\n';
      
      case 'heading_1':
        return '# ' + this.richTextToMarkdown(block.heading_1.rich_text) + '\n\n';
      
      case 'heading_2':
        return '## ' + this.richTextToMarkdown(block.heading_2.rich_text) + '\n\n';
      
      case 'heading_3':
        return '### ' + this.richTextToMarkdown(block.heading_3.rich_text) + '\n\n';
      
      case 'bulleted_list_item':
        return '- ' + this.richTextToMarkdown(block.bulleted_list_item.rich_text) + '\n';
      
      case 'numbered_list_item':
        return '1. ' + this.richTextToMarkdown(block.numbered_list_item.rich_text) + '\n';
      
      case 'code':
        const code = this.richTextToMarkdown(block.code.rich_text);
        const language = block.code.language || '';
        return '```' + language + '\n' + code + '\n```\n\n';
      
      case 'quote':
        return '> ' + this.richTextToMarkdown(block.quote.rich_text) + '\n\n';
      
      case 'divider':
        return '---\n\n';
      
      case 'callout':
        const calloutText = this.richTextToMarkdown(block.callout.rich_text);
        return '> 💡 ' + calloutText + '\n\n';
      
      default:
        return '';
    }
  }

  /**
   * Convert rich text to markdown
   */
  private richTextToMarkdown(richText: any[]): string {
    if (!richText) return '';

    return richText.map((text) => {
      let content = text.plain_text;

      if (text.annotations.bold) content = `**${content}**`;
      if (text.annotations.italic) content = `*${content}*`;
      if (text.annotations.code) content = `\`${content}\``;
      if (text.href) content = `[${content}](${text.href})`;

      return content;
    }).join('');
  }

  /**
   * Import page to RAG
   */
  async importPage(pageId: string): Promise<{
    title: string;
    content: string;
    url: string;
  }> {
    const page = await this.client.pages.retrieve({ page_id: pageId });
    const content = await this.getPageContent(pageId);

    return {
      title: (page as any).properties?.title?.title?.[0]?.plain_text || 'Untitled',
      content,
      url: (page as any).url,
    };
  }
}

export default NotionIntegration;
