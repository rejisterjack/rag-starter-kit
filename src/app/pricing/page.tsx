import { Check, ExternalLink, Github, Mail, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Pricing — RAG Starter Kit',
  description:
    'RAG Starter Kit is free and open-source forever. Self-host for $0, or contact us about a managed cloud deployment for your team.',
};

const features = {
  selfHosted: [
    'Full RAG pipeline (ingest, embed, retrieve, generate)',
    'Streaming SSE responses',
    'Voice input & output',
    'Multi-user workspaces with RBAC',
    'Admin dashboard & document management',
    'Agent mode (web search, calculator, code)',
    'Background job processing (Inngest)',
    'Rate limiting & audit logging',
    'OAuth (GitHub, Google) + credentials auth',
    'API key authentication',
    'PWA support (offline, installable)',
    'E2E tests + CI/CD pipelines',
    'One-click deploy to Vercel / Railway / Render',
    'MIT License — own it completely',
  ],
  cloud: [
    'Everything in Self-Hosted',
    'Managed PostgreSQL + pgvector',
    'Managed Redis (rate limiting & caching)',
    'Managed Cloudinary (file storage)',
    'Automatic backups & point-in-time recovery',
    'SSL certificates & custom domains',
    'SLA-backed uptime monitoring',
    'Email support with 48h response time',
    'Usage analytics dashboard',
    'Automatic dependency updates',
  ],
  enterprise: [
    'Everything in Cloud Hosted',
    'SAML 2.0 SSO (Okta, Azure AD, Google Workspace)',
    'Dedicated infrastructure (no shared tenancy)',
    'Custom data residency (EU, US, APAC)',
    'Custom SLA (99.9%+ uptime)',
    'Dedicated Slack channel with engineering access',
    'Security review & compliance documentation',
    'Custom model & embedding provider configuration',
    'White-label deployment options',
    'Net-30 invoicing',
  ],
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-6 text-sm font-medium border border-primary/20">
          <Zap className="h-4 w-4" />
          <span>Simple, transparent pricing</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
          Free Forever.
          <br />
          <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            Seriously.
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          The self-hosted version is MIT-licensed and costs nothing. You own the code, the data, and
          the infrastructure. A managed cloud option is coming for teams who want zero ops.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Self-Hosted */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2.5 py-1 mb-4">
                <span>● Free Forever</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Self-Hosted</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Clone the repo, configure two free API keys, and deploy. You own everything.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-foreground">$0</span>
                <span className="text-muted-foreground pb-1">/ forever</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Free AI via OpenRouter + Google Gemini
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              {features.selfHosted.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 mt-auto">
              <Button asChild className="w-full rounded-xl h-11">
                <Link
                  href="https://github.com/rejisterjack/rag-starter-kit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  Clone on GitHub
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-xl h-11">
                <Link href="/demo">Try the live demo first</Link>
              </Button>
            </div>
          </div>

          {/* Cloud Hosted */}
          <div className="rounded-2xl border-2 border-primary bg-card p-8 flex flex-col relative shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
                Coming Soon
              </span>
            </div>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 mb-4">
                <span>Managed Cloud</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Cloud Hosted</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                All the power of RAG Starter Kit with zero infrastructure to manage. We handle
                databases, backups, and deployments.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-foreground">TBD</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pricing being finalised. Join the waitlist for early access.
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              {features.cloud.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <Button asChild className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90">
                <Link
                  href="https://github.com/rejisterjack/rag-starter-kit/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Join the waitlist
                </Link>
              </Button>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1 mb-4">
                <span>Enterprise</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Enterprise</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Dedicated infrastructure, SAML SSO, custom SLAs, and direct engineering access for
                large organisations.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-foreground">Contact Us</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Custom pricing based on usage</p>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              {features.enterprise.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <Button asChild variant="outline" className="w-full rounded-xl h-11">
                <Link
                  href="https://github.com/rejisterjack/rag-starter-kit/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Get in touch
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            {[
              {
                q: 'Is the self-hosted version really free?',
                a: 'Yes. The entire codebase is MIT-licensed. You clone it, deploy it to your own infrastructure, and owe nothing. The AI models it uses by default (OpenRouter free tier, Google Gemini free tier) are also free for development and moderate production usage.',
              },
              {
                q: 'What AI providers does it support?',
                a: 'By default it uses OpenRouter (free models: DeepSeek, Mistral, Llama, Gemma) for chat and Google Gemini for embeddings. You can switch to OpenAI, Anthropic Claude, or a self-hosted Ollama instance by changing a single environment variable.',
              },
              {
                q: "What's the difference between Self-Hosted and Cloud Hosted?",
                a: 'Self-Hosted means you manage your own PostgreSQL, Redis, and file storage. Cloud Hosted (coming soon) means we manage all of that for you — you just bring your AI API keys and documents.',
              },
              {
                q: 'Can I use this commercially?',
                a: 'Yes. The MIT license has no restrictions on commercial use. You can build products on top of it, charge your clients for it, and white-label the UI. The only requirement is that you retain the MIT license notice in the codebase.',
              },
              {
                q: 'Do you offer a trial of the Cloud/Enterprise tier?',
                a: 'Cloud Hosted is currently in development. Join the waitlist on GitHub Discussions to be notified and get early access pricing. Enterprise evaluations are handled case-by-case — reach out via GitHub Discussions.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-border/50 pb-8">
                <h3 className="font-semibold text-foreground mb-3">{q}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
