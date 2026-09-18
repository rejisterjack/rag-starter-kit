export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Reference',
  description:
    'Technical reference for environment variables, database schema, and RBAC permissions.',
};

const references = [
  {
    title: 'Environment Variables',
    description:
      'Complete list of all environment variables with types, defaults, and descriptions.',
    href: '/docs/reference/environment-variables',
    icon: '{}',
  },
  {
    title: 'Database Schema',
    description: 'Key database models, relationships, and the vector storage architecture.',
    href: '/docs/reference/database-schema',
    icon: 'DB',
  },
  {
    title: 'RBAC Permissions',
    description:
      'The 18-permission role-based access control system and workspace authorization model.',
    href: '/docs/reference/rbac-permissions',
    icon: 'AC',
  },
];

export default function ReferencePage() {
  return (
    <DocsShell
      path="/docs/reference"
      title="Reference"
      description="Reference material: environment variables, database schema, RBAC permissions."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Reference</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Technical reference documentation for the RAG Starter Kit internals.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {references.map((ref) => (
            <Link
              key={ref.href}
              href={ref.href}
              className="block p-5 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <div className="text-2xl font-mono font-bold text-primary mb-3">{ref.icon}</div>
              <h2 className="font-semibold mb-1">{ref.title}</h2>
              <p className="text-sm text-muted-foreground">{ref.description}</p>
            </Link>
          ))}
        </div>

        <div className="flex justify-between pt-8 border-t border-border">
          <Link
            href="/docs/guides"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Guides
          </Link>
          <span />
        </div>
      </div>
    </DocsShell>
  );
}
