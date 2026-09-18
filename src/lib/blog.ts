/**
 * Blog content layer.
 *
 * Reads MDX posts from content/blog, parses frontmatter, and exposes typed
 * helpers used by the blog pages, sitemap, llms.txt, and RSS feed.
 * Frontmatter parsing is intentionally dependency-free.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  /** Flattened markdown body (frontmatter stripped) */
  body: string;
  readingMinutes: number;
  wordCount: number;
}

interface FrontmatterResult {
  data: Record<string, string | string[]>;
  body: string;
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

function parseFrontmatter(raw: string): FrontmatterResult {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, body: raw };

  const [, frontmatterBlock, body] = match;
  const data: Record<string, string | string[]> = {};

  for (const line of frontmatterBlock.split('\n')) {
    const fmMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!fmMatch) continue;
    const [, key, value] = fmMatch;
    const trimmed = value.trim();
    // Inline array: [a, b, c]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      data[key] = trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      data[key] = trimmed.replace(/^['"]|['"]$/g, '');
    }
  }

  return { data, body };
}

function toPost(slug: string, raw: string): BlogPost | null {
  const { data, body } = parseFrontmatter(raw);
  if (!data.title || !data.description || !data.publishedAt) return null;

  const wordCount = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    slug,
    title: String(data.title),
    description: String(data.description),
    author: data.author ? String(data.author) : 'Rupam Das',
    publishedAt: String(data.publishedAt),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : data.tags ? [String(data.tags)] : [],
    body,
    readingMinutes: Math.max(1, Math.round(wordCount / 220)),
    wordCount,
  };
}

let cachedPosts: BlogPost[] | null = null;

export function getAllPosts(): BlogPost[] {
  if (cachedPosts) return cachedPosts;
  if (typeof window !== 'undefined') return [];

  let files: string[] = [];
  try {
    files = fs.readdirSync(CONTENT_DIR).filter((f) => /\.mdx?$/.test(f));
  } catch {
    cachedPosts = [];
    return cachedPosts;
  }

  cachedPosts = files
    .map((file) => {
      const slug = file.replace(/\.mdx?$/, '');
      try {
        return toPost(slug, fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  return cachedPosts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}
