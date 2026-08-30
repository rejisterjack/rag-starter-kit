export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Guides',
  description:
    'Step-by-step guides for configuring providers, deploying, and extending the RAG Starter Kit.',
};

const guides = [
  {
    title: 'Embedding Providers',
    description: 'Configure Google Gemini, OpenAI, or Ollama for document embeddings.',
    href: '/docs/guides/embedding-providers',
    tags: ['Google', 'OpenAI', 'Ollama'],
  },
  {
    title: 'LLM Providers',
    description: 'Switch between OpenRouter, OpenAI, Anthropic, Google, and local models.',
    href: '/docs/guides/llm-providers',
    tags: ['OpenRouter', 'Anthropic', 'Local'],
  },
  {
    title: 'Deployment',
    description: 'Deploy to Vercel, Railway, or Docker with production best practices.',
    href: '/docs/guides/deployment',
    tags: ['Vercel', 'Railway', 'Docker'],
  },
  {
    title: 'Authentication',
    description: 'Set up OAuth providers, SAML SSO, and API key authentication.',
    href: '/docs/guides/authentication',
    tags: ['OAuth', 'SAML', 'API Keys'],
  },
  {
    title: 'Chrome Extension',
    description:
      'Install and use the Chrome extension to save web pages and ask about selected text.',
    href: '/docs/guides/chrome-extension',
    tags: ['Chrome', 'Web Store', 'Manifest V3'],
  },
];

export default function GuidesPage() {
  return (
    <DocsShell
      path="/docs/guides"
      title="Guides"
      description="Deep-dive guides for RAG Starter Kit providers, deployment, and security."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Guides</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Practical guides for configuring, deploying, and extending your RAG Starter Kit.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="block p-5 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <h2 className="font-semibold mb-1">{guide.title}</h2>
              <p className="text-sm text-muted-foreground mb-3">{guide.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {guide.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <div className="flex justify-between pt-8 border-t border-border">
          <Link
            href="/docs/api"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; API Reference
          </Link>
          <Link href="/docs/reference" className="text-sm text-primary hover:underline">
            Reference &rarr;
          </Link>
        </div>
      </div>
    </DocsShell>
  );
}
