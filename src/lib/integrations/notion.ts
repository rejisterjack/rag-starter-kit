/**
 * Notion Integration
 * Import pages and databases from Notion
 */

// Type definitions for Notion API
interface NotionText {
  plain_text: string;
  annotations: {
    bold: boolean;
    italic: boolean;
    code: boolean;
  };
  href: string | null;
}

interface NotionRichText {
  rich_text: NotionText[];
}

interface NotionParagraphBlock {
  type: 'paragraph';
  paragraph: NotionRichText;
}

interface NotionHeading1Block {
  type: 'heading_1';
  heading_1: NotionRichText;
}

interface NotionHeading2Block {
  type: 'heading_2';
  heading_2: NotionRichText;
}

interface NotionHeading3Block {
  type: 'heading_3';
  heading_3: NotionRichText;
}

interface NotionBulletedListItemBlock {
  type: 'bulleted_list_item';
  bulleted_list_item: NotionRichText;
}

interface NotionNumberedListItemBlock {
  type: 'numbered_list_item';
  numbered_list_item: NotionRichText;
}

interface NotionCodeBlock {
  type: 'code';
  code: NotionRichText & { language: string };
}

interface NotionQuoteBlock {
  type: 'quote';
  quote: NotionRichText;
}

interface NotionDividerBlock {
  type: 'divider';
  divider: Record<string, unknown>;
}

interface NotionCalloutBlock {
  type: 'callout';
  callout: NotionRichText;
}

type NotionBlock =
  | NotionParagraphBlock
  | NotionHeading1Block
  | NotionHeading2Block
  | NotionHeading3Block
  | NotionBulletedListItemBlock
  | NotionNumberedListItemBlock
  | NotionCodeBlock
  | NotionQuoteBlock
  | NotionDividerBlock
  | NotionCalloutBlock;

interface NotionSearchResult {
  id: string;
  url: string;
  last_edited_time: string;
  properties?: {
    title?: {
      title: Array<{ plain_text: string }>;
    };
  };
}

interface NotionPage {
  id: string;
  url: string;
  properties?: {
    title?: {
      title: Array<{ plain_text: string }>;
    };
  };
}

// Notion Client class definition (minimal implementation)
class NotionClient {
  private auth: string;

  constructor(options: { auth: string }) {
    this.auth = options.auth;
  }

  private async request<T>(endpoint: string, options?: { method?: string; body?: unknown }): Promise<T> {
    const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
      method: options?.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${this.auth}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  search = {
    list: async (params?: { filter?: { value: string; property: string }; query?: string }): Promise<{ results: NotionSearchResult[] }> => {
      return this.request<{ results: NotionSearchResult[] }>('/search', {
        method: 'POST',
        body: params,
      });
    },
  };

  blocks = {
    children: {
      list: async (params: { block_id: string }): Promise<{ results: NotionBlock[] }> => {
        return this.request<{ results: NotionBlock[] }>(`/blocks/${params.block_id}/children`);
      },
    },
  };

  pages = {
    retrieve: async (params: { page_id: string }): Promise<NotionPage> => {
      return this.request<NotionPage>(`/pages/${params.page_id}`);
    },
  };
}

export class NotionIntegration {
  private client: NotionClient;

  constructor(accessToken: string) {
    this.client = new NotionClient({ auth: accessToken });
  }

  /**
   * List available pages
   */
  async listPages(): Promise<Array<{ id: string; title: string; url: string; lastEdited: string }>> {
    const response = await this.client.search.list({
      filter: { value: 'page', property: 'object' },
    });

    return response.results.map((page) => ({
      id: page.id,
      title: page.properties?.title?.title?.[0]?.plain_text ?? 'Untitled',
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
      markdown += this.blockToMarkdown(block);
    }

    return markdown;
  }

  /**
   * Convert Notion block to Markdown
   */
  private blockToMarkdown(block: NotionBlock): string {
    const blockType = block.type;
    
    switch (blockType) {
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
      
      case 'code': {
        const code = this.richTextToMarkdown(block.code.rich_text);
        const language = block.code.language ?? '';
        return '```' + language + '\n' + code + '\n```\n\n';
      }
      
      case 'quote':
        return '> ' + this.richTextToMarkdown(block.quote.rich_text) + '\n\n';
      
      case 'divider':
        return '---\n\n';
      
      case 'callout': {
        const calloutText = this.richTextToMarkdown(block.callout.rich_text);
        return '> 💡 ' + calloutText + '\n\n';
      }
      
      default:
        return '';
    }
  }

  /**
   * Convert rich text to markdown
   */
  private richTextToMarkdown(richText: NotionText[]): string {
    if (richText === undefined || richText.length === 0) return '';

    return richText.map((text) => {
      let content = text.plain_text;

      if (text.annotations.bold) content = `**${content}**`;
      if (text.annotations.italic) content = `*${content}*`;
      if (text.annotations.code) content = `\`${content}\``;
      if (text.href !== null) content = `[${content}](${text.href})`;

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
      title: page.properties?.title?.title?.[0]?.plain_text ?? 'Untitled',
      content,
      url: page.url,
    };
  }
}

export default NotionIntegration;
