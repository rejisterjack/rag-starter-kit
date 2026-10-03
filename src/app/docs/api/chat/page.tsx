export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Chat API',
  description:
    'Send messages and receive AI-powered responses with RAG context. Supports streaming and conversation history.',
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

export default function ChatApiPage() {
  return (
    <DocsShell
      path="/docs/api/chat"
      title="Chat API"
      description="Chat endpoint reference: streaming SSE, request/response schemas, and parameters."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Chat API</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The chat API powers the core conversational experience. It retrieves relevant document
          chunks, injects them as context, and streams the LLM response back to the client.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Send a Message</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-mono font-bold mb-3">
              POST
            </div>
            <code className="text-sm ml-2">/api/chat</code>

            <h3 className="font-semibold mt-4 mb-2">Request Body</h3>
            <Code title="application/json">{`{
  "message": "What is the refund policy?",
  "conversationId": "conv_abc123",  // optional, creates new if omitted
  "stream": true                     // optional, default true
}`}</Code>

            <h3 className="font-semibold mt-4 mb-2">Streaming Response</h3>
            <p className="text-muted-foreground mb-3">
              When <code className="bg-muted px-1 rounded text-sm">stream: true</code> (default),
              the response is sent as Server-Sent Events (SSE). Each event is a JSON chunk of the
              generated text.
            </p>
            <Code title="text/event-stream">{`data: {"content": "Based on "}
data: {"content": "the document, "}
data: {"content": "refunds are processed within 30 days."}
data: [DONE]`}</Code>

            <h3 className="font-semibold mt-4 mb-2">Non-Streaming Response</h3>
            <Code title="application/json">{`{
  "content": "Based on the document, refunds are processed within 30 days.",
  "sources": [
    {
      "documentId": "doc_xyz",
      "documentName": "terms-of-service.pdf",
      "page": 4,
      "relevanceScore": 0.92
    }
  ],
  "conversationId": "conv_abc123"
}`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Get Conversation History</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-mono font-bold mb-3">
              GET
            </div>
            <code className="text-sm ml-2">/api/chat?conversationId=conv_abc123</code>

            <h3 className="font-semibold mt-4 mb-2">Response</h3>
            <Code title="application/json">{`{
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "What is the refund policy?",
      "createdAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "Based on the document, refunds are processed within 30 days.",
      "sources": [...],
      "createdAt": "2025-01-15T10:30:05Z"
    }
  ]
}`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Error Responses</h2>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <span className="font-mono font-bold text-red-500">400</span>
                <span className="text-muted-foreground">Missing or invalid request body</span>
              </div>
              <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <span className="font-mono font-bold text-red-500">401</span>
                <span className="text-muted-foreground">Not authenticated</span>
              </div>
              <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <span className="font-mono font-bold text-red-500">429</span>
                <span className="text-muted-foreground">
                  Rate limit exceeded (see Retry-After header)
                </span>
              </div>
              <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <span className="font-mono font-bold text-red-500">500</span>
                <span className="text-muted-foreground">
                  LLM provider error or internal failure
                </span>
              </div>
            </div>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/api"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; API Overview
            </Link>
            <Link href="/docs/api/documents" className="text-sm text-primary hover:underline">
              Documents API &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
