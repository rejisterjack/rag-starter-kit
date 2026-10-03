export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Documents API',
  description: 'Upload, list, retrieve, delete, and re-ingest documents through the REST API.',
};

function Code({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4">
      {title && (
        <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          {title}
        </div>
      )}
      <pre className="bg-card p-4 overflow-x-auto text-sm">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function DocumentsApiPage() {
  return (
    <DocsShell
      path="/docs/api/documents"
      title="Documents API"
      description="Document ingestion API: upload, list, delete, and webhook ingestion endpoints."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Documents API</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Manage documents in your workspace. Upload files for automatic parsing, chunking, and
          embedding. Supported formats: PDF, DOCX, TXT, HTML, Markdown, and more.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Upload a Document</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-mono font-bold mb-3">
              POST
            </div>
            <code className="text-sm ml-2">/api/documents</code>

            <h3 className="font-semibold mt-4 mb-2">Request</h3>
            <p className="text-muted-foreground mb-2">
              Send the file as{' '}
              <code className="bg-muted px-1 rounded text-sm">multipart/form-data</code> with field
              name <code className="bg-muted px-1 rounded text-sm">file</code>.
            </p>
            <Code title="curl">{`curl -X POST https://your-domain.com/api/documents \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -F "file=@report.pdf"`}</Code>

            <h3 className="font-semibold mt-4 mb-2">Response</h3>
            <Code title="application/json">{`{
  "id": "doc_abc123",
  "name": "report.pdf",
  "status": "processing",
  "createdAt": "2025-01-15T10:30:00Z"
}`}</Code>
            <p className="text-muted-foreground text-sm">
              The document is processed asynchronously by Inngest. Check status via GET
              /api/documents/:id.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">List Documents</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-mono font-bold mb-3">
              GET
            </div>
            <code className="text-sm ml-2">/api/documents</code>

            <h3 className="font-semibold mt-4 mb-2">Response</h3>
            <Code title="application/json">{`{
  "documents": [
    {
      "id": "doc_abc123",
      "name": "report.pdf",
      "status": "completed",
      "chunkCount": 47,
      "createdAt": "2025-01-15T10:30:00Z",
      "ingestionJob": {
        "status": "completed",
        "errorCategory": null
      }
    }
  ]
}`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Get Document</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-mono font-bold mb-3">
              GET
            </div>
            <code className="text-sm ml-2">/api/documents/:id</code>

            <h3 className="font-semibold mt-4 mb-2">Response</h3>
            <Code title="application/json">{`{
  "id": "doc_abc123",
  "name": "report.pdf",
  "status": "completed",
  "chunkCount": 47,
  "createdAt": "2025-01-15T10:30:00Z",
  "ingestionJob": {
    "id": "job_xyz",
    "status": "completed",
    "errorCategory": null,
    "startedAt": "2025-01-15T10:30:01Z",
    "completedAt": "2025-01-15T10:30:28Z"
  }
}`}</Code>

            <h3 className="font-semibold mt-4 mb-2">Error Categories</h3>
            <p className="text-muted-foreground mb-2">
              When ingestion fails, the{' '}
              <code className="bg-muted px-1 rounded text-sm">errorCategory</code> field indicates
              why:
            </p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                <code className="bg-muted px-1 rounded text-xs">PARSE_ERROR</code> — Document could
                not be parsed (corrupt file, unsupported format)
              </div>
              <div>
                <code className="bg-muted px-1 rounded text-xs">EMBEDDING_ERROR</code> — Embedding
                provider failed (API key, rate limit, dimension mismatch)
              </div>
              <div>
                <code className="bg-muted px-1 rounded text-xs">SIZE_LIMIT</code> — Document exceeds
                workspace size limits
              </div>
              <div>
                <code className="bg-muted px-1 rounded text-xs">OCR_FAILURE</code> — OCR failed on
                scanned content
              </div>
              <div>
                <code className="bg-muted px-1 rounded text-xs">NETWORK_ERROR</code> — Network
                connectivity issue during processing
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Delete Document</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs font-mono font-bold mb-3">
              DELETE
            </div>
            <code className="text-sm ml-2">/api/documents/:id</code>

            <h3 className="font-semibold mt-4 mb-2">Response</h3>
            <Code title="application/json">{`{
  "success": true,
  "message": "Document deleted"
}`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Re-ingest Document</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-mono font-bold mb-3">
              POST
            </div>
            <code className="text-sm ml-2">/api/documents/:id/re-ingest</code>

            <p className="text-muted-foreground text-sm">
              Retries ingestion for a failed document, or re-processes a successfully ingested
              document. Existing chunks are replaced with new ones.
            </p>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/api/chat"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Chat API
            </Link>
            <Link href="/docs/api/embeddings" className="text-sm text-primary hover:underline">
              Embeddings API &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
