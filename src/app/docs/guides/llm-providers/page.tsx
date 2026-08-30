export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'LLM Providers',
  description:
    'Configure OpenRouter, OpenAI, Anthropic, Google, or local Ollama models for chat responses.',
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

export default function LlmProvidersPage() {
  return (
    <DocsShell
      path="/docs/guides/llm-providers"
      title="LLM Providers"
      description="How to configure LLM providers: OpenRouter, Gemini, OpenAI, Anthropic, Ollama."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">LLM Providers</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The RAG Starter Kit uses a provider factory pattern that supports multiple LLM backends.
          The default is OpenRouter, which gives access to hundreds of models including free ones.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">OpenRouter (Default)</h2>
            <p className="text-muted-foreground mb-3">
              OpenRouter provides a unified API for 200+ models from OpenAI, Anthropic, Google,
              Meta, and more. It includes free models (with rate limits) so you can evaluate the kit
              without spending anything.
            </p>
            <Code title=".env">{`OPENROUTER_API_KEY=sk-or-...`}</Code>
            <p className="text-muted-foreground text-sm">
              Get a key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                openrouter.ai/keys
              </a>
              . The model is selected in the chat UI via the model picker.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">OpenAI</h2>
            <Code title=".env">{`OPENAI_API_KEY=sk-...`}</Code>
            <p className="text-muted-foreground text-sm">
              Supports GPT-4o, GPT-4o-mini, and o1 models. The API key is also used for OpenAI
              embeddings when configured.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Anthropic</h2>
            <p className="text-muted-foreground mb-3">
              Access Claude models directly through the Anthropic API.
            </p>
            <Code title=".env">{`ANTHROPIC_API_KEY=sk-ant-...`}</Code>
            <p className="text-muted-foreground text-sm">
              Available when selected in the chat model picker via OpenRouter, or configure directly
              for Claude-only usage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Google Gemini</h2>
            <p className="text-muted-foreground mb-3">
              Use Gemini models for both chat and embeddings.
            </p>
            <Code title=".env">{`GOOGLE_GENERATIVE_AI_API_KEY=AIza...`}</Code>
            <p className="text-muted-foreground text-sm">
              Free tier includes generous usage limits. Works for both embedding and chat when
              configured.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Ollama (Local)</h2>
            <p className="text-muted-foreground mb-3">
              Run models locally for complete data privacy and zero API costs.
            </p>
            <Code title=".env">{`OLLAMA_BASE_URL=http://localhost:11434`}</Code>
            <Code title="Install a model">{`ollama pull llama3.2
ollama pull mistral`}</Code>
            <p className="text-muted-foreground text-sm">
              Requires Ollama running locally. Supports any model available in the Ollama library.
              Ideal for air-gapped environments or when data must not leave your network.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">How Providers Are Selected</h2>
            <p className="text-muted-foreground mb-3">
              The provider factory (
              <code className="bg-muted px-1 rounded text-sm">src/lib/ai/llm/factory.ts</code>)
              resolves the LLM provider from the model ID selected in the chat UI. The model picker
              shows available models based on which API keys are configured. If only OpenRouter is
              configured, you see all OpenRouter models. If additional keys are set, those providers
              become available too.
            </p>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/guides/embedding-providers"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Embedding Providers
            </Link>
            <Link href="/docs/guides/deployment" className="text-sm text-primary hover:underline">
              Deployment &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
