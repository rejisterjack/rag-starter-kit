export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Database Schema',
  description:
    'Key database models, relationships, and the pgvector storage architecture used by the RAG Starter Kit.',
};

function ModelCard({
  name,
  description,
  fields,
}: {
  name: string;
  description: string;
  fields: { name: string; type: string; note?: string }[];
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-6">
      <div className="bg-muted/50 px-4 py-3 border-b border-border">
        <h3 className="font-semibold font-mono">{name}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-border">
            {fields.map((f) => (
              <tr key={f.name}>
                <td className="px-4 py-1.5 font-mono text-xs text-primary whitespace-nowrap">
                  {f.name}
                </td>
                <td className="px-4 py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {f.type}
                </td>
                {f.note && <td className="px-4 py-1.5 text-xs text-muted-foreground">{f.note}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DatabaseSchemaPage() {
  return (
    <DocsShell
      path="/docs/reference/database-schema"
      title="Database Schema"
      description="Prisma schema reference: all models, relations, and pgvector columns."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Database Schema</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The RAG Starter Kit uses PostgreSQL with pgvector for both relational metadata and
          embeddings. The schema is managed by Prisma and includes models for users, workspaces,
          documents, chat, and RBAC.
        </p>

        <div className="space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Core Models</h2>
            <ModelCard
              name="User"
              description="Application users with authentication details"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                { name: 'email', type: 'String (unique)', note: 'User email' },
                { name: 'name', type: 'String?', note: 'Display name' },
                { name: 'image', type: 'String?', note: 'Avatar URL' },
                { name: 'role', type: 'UserRole', note: 'USER, ADMIN' },
              ]}
            />
            <ModelCard
              name="Workspace"
              description="Isolated tenant containers for multi-tenancy"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                { name: 'name', type: 'String', note: 'Workspace display name' },
                { name: 'slug', type: 'String (unique)', note: 'URL-friendly identifier' },
                { name: 'ownerId', type: 'String', note: 'FK → User' },
              ]}
            />
            <ModelCard
              name="WorkspaceMember"
              description="User-workspace membership with roles"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                { name: 'userId', type: 'String', note: 'FK → User' },
                { name: 'workspaceId', type: 'String', note: 'FK → Workspace' },
                { name: 'role', type: 'WorkspaceRole', note: 'OWNER, ADMIN, EDITOR, VIEWER' },
              ]}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Document &amp; Vector Storage</h2>
            <ModelCard
              name="Document"
              description="Uploaded documents in a workspace"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                { name: 'name', type: 'String', note: 'Original filename' },
                { name: 'url', type: 'String', note: 'Storage URL' },
                { name: 'mimeType', type: 'String', note: 'File MIME type' },
                { name: 'size', type: 'Int', note: 'File size in bytes' },
                { name: 'workspaceId', type: 'String', note: 'FK → Workspace' },
              ]}
            />
            <ModelCard
              name="DocumentChunk"
              description="Text chunks with pgvector embeddings and metadata"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                { name: 'content', type: 'String', note: 'Chunk text content' },
                { name: 'embedding', type: 'vector(768)', note: 'pgvector cosine HNSW' },
                { name: 'index', type: 'Int', note: 'Position in document' },
                { name: 'page', type: 'Int?', note: 'Page number' },
                { name: 'section', type: 'String?', note: 'Section heading' },
                { name: 'documentId', type: 'String', note: 'FK → Document' },
                { name: 'userId', type: 'String', note: 'FK → User' },
                { name: 'workspaceId', type: 'String?', note: 'FK → Workspace' },
              ]}
            />
            <ModelCard
              name="IngestionJob"
              description="Background job tracking for document processing"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                {
                  name: 'status',
                  type: 'IngestionStatus',
                  note: 'PENDING, PROCESSING, COMPLETED, FAILED',
                },
                {
                  name: 'errorCategory',
                  type: 'ErrorCategory?',
                  note: 'PARSE_ERROR, EMBEDDING_ERROR, etc.',
                },
                { name: 'documentId', type: 'String', note: 'FK → Document' },
              ]}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Chat</h2>
            <ModelCard
              name="Conversation"
              description="Chat conversations tied to a workspace"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                { name: 'title', type: 'String?', note: 'Auto-generated or user-set title' },
                { name: 'workspaceId', type: 'String', note: 'FK → Workspace' },
                { name: 'userId', type: 'String', note: 'FK → User' },
              ]}
            />
            <ModelCard
              name="Message"
              description="Individual messages in a conversation"
              fields={[
                { name: 'id', type: 'String (cuid)', note: 'Primary key' },
                { name: 'role', type: 'String', note: 'user, assistant, system' },
                { name: 'content', type: 'String', note: 'Message text' },
                { name: 'sources', type: 'Json?', note: 'Cited document chunks' },
                { name: 'conversationId', type: 'String', note: 'FK → Conversation' },
              ]}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Vector Search Architecture</h2>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm space-y-3">
              <p className="text-muted-foreground">
                Document chunk embeddings are stored in PostgreSQL as 768-dimensional pgvector
                columns with an HNSW index. Keyword search uses a generated tsvector column.
                Similarity search uses cosine distance ({'(`<=>`)'} for approximate nearest neighbor
                queries.
              </p>
              <p className="text-muted-foreground">
                The hybrid retrieval pipeline combines vector similarity search with full-text
                search (PostgreSQL tsvector) using Reciprocal Rank Fusion (RRF) to merge results
                from both sources for optimal relevance.
              </p>
            </div>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/reference/environment-variables"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Environment Variables
            </Link>
            <Link
              href="/docs/reference/rbac-permissions"
              className="text-sm text-primary hover:underline"
            >
              RBAC Permissions &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
