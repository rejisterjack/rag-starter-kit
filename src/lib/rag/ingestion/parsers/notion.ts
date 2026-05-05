/**
 * Notion Connector
 *
 * Ingests content from a Notion page (by URL or page ID) using the public
 * Notion API. Requires NOTION_API_KEY in environment variables.
 *
 * Supported content:
 *   - Paragraph, heading, bullet/numbered list, toggle, code, quote blocks
 *   - Nested child blocks (one level of recursion)
 *   - Page title from page properties
 *
 * Usage:
 *   const parser = new NotionParser(apiKey);
 *   const result = await parser.parse("https://www.notion.so/My-Page-abc123def456");
 */

import { logger } from '@/lib/logger';

export interface NotionParseResult {
  title: string;
  content: string;
  pageId: string;
  url: string;
  lastEditedAt?: string;
}

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/** Extract a Notion page ID from a URL or return the string as-is if it's already an ID */
export function extractNotionPageId(urlOrId: string): string {
  // Full URL: https://www.notion.so/Title-<32-hex-chars> or /<workspace>/<title>-<id>
  const match = urlOrId.match(/([a-f0-9]{32})(?:[?#]|$)/i);
  if (match) {
    // Insert dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const id = match[1];
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }
  // Already formatted UUID
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(urlOrId)) {
    return urlOrId;
  }
  throw new Error(`Could not extract a Notion page ID from: ${urlOrId}`);
}

type NotionBlock = {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
};

/** Render a single Notion block to plain text */
function blockToText(block: NotionBlock): string {
  const type = block.type;
  // biome-ignore lint/suspicious/noExplicitAny: Notion API response is loosely typed
  const data = (block as any)[type];
  if (!data) return '';

  const richTexts: Array<{ plain_text: string }> = data.rich_text ?? [];
  const text = richTexts.map((rt) => rt.plain_text).join('');

  switch (type) {
    case 'heading_1':
      return `# ${text}`;
    case 'heading_2':
      return `## ${text}`;
    case 'heading_3':
      return `### ${text}`;
    case 'bulleted_list_item':
      return `• ${text}`;
    case 'numbered_list_item':
      return `1. ${text}`;
    case 'to_do':
      return `[${data.checked ? 'x' : ' '}] ${text}`;
    case 'toggle':
      return `▸ ${text}`;
    case 'quote':
      return `> ${text}`;
    case 'code':
      return `\`\`\`${data.language ?? ''}\n${text}\n\`\`\``;
    case 'divider':
      return '---';
    case 'callout':
      return `💡 ${text}`;
    case 'paragraph':
    default:
      return text;
  }
}

export class NotionParser {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('NOTION_API_KEY is required');
    this.apiKey = apiKey;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${NOTION_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Notion API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /** Fetch all blocks for a page (handles pagination, one level of children) */
  private async fetchBlocks(blockId: string, depth = 0): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;

    do {
      const url = `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`;
      // biome-ignore lint/suspicious/noExplicitAny: Notion API response
      const data = await this.get<any>(url);
      const results: NotionBlock[] = data.results ?? [];
      blocks.push(...results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    // Fetch one level of children
    if (depth < 1) {
      for (const block of blocks) {
        if (block.has_children) {
          block._children = await this.fetchBlocks(block.id, depth + 1);
        }
      }
    }

    return blocks;
  }

  /** Parse a Notion page by URL or page ID and return structured text */
  async parse(urlOrId: string): Promise<NotionParseResult> {
    const pageId = extractNotionPageId(urlOrId);
    logger.info('Parsing Notion page', { pageId });

    // Get page metadata (title, last edited)
    // biome-ignore lint/suspicious/noExplicitAny: Notion API response
    const page = await this.get<any>(`/pages/${pageId}`);
    const properties = page.properties ?? {};

    // Title is usually in the "title" or "Name" property
    let title = 'Untitled';
    for (const prop of Object.values(properties) as Array<{
      type: string;
      title?: Array<{ plain_text: string }>;
    }>) {
      if (prop.type === 'title' && prop.title?.length) {
        title = prop.title.map((t) => t.plain_text).join('');
        break;
      }
    }

    const lastEditedAt: string | undefined = page.last_edited_time;
    const pageUrl = page.url ?? `https://www.notion.so/${pageId.replace(/-/g, '')}`;

    // Get all blocks
    const blocks = await this.fetchBlocks(pageId);

    // Render blocks to text
    const lines: string[] = [`# ${title}`, ''];
    for (const block of blocks) {
      const line = blockToText(block);
      if (line) lines.push(line);

      // Render children (nested list items, toggles, etc.)
      const children = (block as NotionBlock & { _children?: NotionBlock[] })._children;
      if (children) {
        for (const child of children) {
          const childLine = blockToText(child);
          if (childLine) lines.push(`  ${childLine}`);
        }
      }
    }

    return {
      title,
      content: lines.join('\n'),
      pageId,
      url: pageUrl,
      lastEditedAt,
    };
  }
}
