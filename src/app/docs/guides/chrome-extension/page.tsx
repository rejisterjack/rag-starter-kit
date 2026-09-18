export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Chrome Extension',
  description:
    'Install and use the Chrome extension to save web pages, ask about selected text, and summarize articles.',
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

export default function ChromeExtensionPage() {
  return (
    <DocsShell
      path="/docs/guides/chrome-extension"
      title="Chrome Extension"
      description="Install and use the bundled Chrome extension for inline RAG chat."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Chrome Extension</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The RAG Starter Kit includes a Chrome extension that lets you save web pages to your
          knowledge base, ask questions about selected text, and summarize articles from any
          website.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Features</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> <strong>Save Page</strong> — Send the
                current page&apos;s content directly to your RAG workspace for ingestion
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> <strong>Ask About Selection</strong>{' '}
                — Highlight text on any page and ask your RAG chatbot about it
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> <strong>Summarize</strong> — Generate
                a summary of the current page using your configured LLM
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> <strong>Side Panel</strong> — Chat
                with your knowledge base in a persistent side panel
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Installation (Development)</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                Build the extension:
                <Code>{`cd extensions/chrome
npm install
npm run build`}</Code>
              </li>
              <li>
                Open Chrome and navigate to{' '}
                <code className="bg-muted px-1 rounded text-sm">chrome://extensions</code>
              </li>
              <li>
                Enable <strong>Developer mode</strong> (toggle in top right)
              </li>
              <li>
                Click <strong>Load unpacked</strong> and select the{' '}
                <code className="bg-muted px-1 rounded text-sm">extensions/chrome</code> directory
              </li>
              <li>The extension icon appears in your toolbar</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Configuration</h2>
            <p className="text-muted-foreground mb-3">
              Click the extension icon to open the popup. Enter your RAG Starter Kit URL and API
              key. The extension stores these securely in Chrome&apos;s local storage.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm">
              <strong>Required:</strong> Your RAG Starter Kit URL (e.g.{' '}
              <code className="bg-card px-1 rounded">https://your-app.vercel.app</code>) and an API
              key generated from the app&apos;s settings page.
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Usage</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Save a Web Page</h3>
                <p className="text-sm text-muted-foreground">
                  Click the extension icon and press <strong>Save Page</strong>. The page content is
                  extracted and sent to your workspace for ingestion. It appears as a new document
                  in your document list.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Ask About Selected Text</h3>
                <p className="text-sm text-muted-foreground">
                  Highlight text on any web page, right-click, and select{' '}
                  <strong>Ask RAG About This</strong>. A popup appears with your chatbot&apos;s
                  answer grounded in your knowledge base.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Summarize a Page</h3>
                <p className="text-sm text-muted-foreground">
                  Click the extension icon and press <strong>Summarize</strong>. The extension sends
                  the page content to your LLM and displays a concise summary.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/guides/authentication"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Authentication
            </Link>
            <Link href="/docs/reference" className="text-sm text-primary hover:underline">
              Reference &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
