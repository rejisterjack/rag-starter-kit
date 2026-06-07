import { Building2, Check, Cloud, ExternalLink, Github, Mail, Sparkles, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Pricing — RAG Starter Kit',
  description:
    'RAG Starter Kit is free and open-source forever under the MIT license. Self-host with zero cost using free-tier AI providers.',
};

const freeFeatures = [
  'Full RAG pipeline (ingest, embed, retrieve, generate)',
  'Streaming SSE responses',
  'Voice input & output',
  'Multi-user workspaces with RBAC',
  'Admin dashboard & document management',
  'Agent mode (web search, calculator, code)',
  '6 free AI models (Gemma, Llama, GPT-OSS, Hermes)',
  'Google Gemini embeddings (free tier)',
  'Background job processing (Inngest)',
  'Rate limiting & audit logging',
  'OAuth (GitHub, Google) + credentials auth',
  'PWA support (offline, installable)',
  'Multi-source ingestion (GitHub, Google Drive, Notion)',
  'One-click deploy to Vercel / Railway / Docker',
  'MIT License — own it completely',
];

const proFeatures = [
  'Everything in Free, plus:',
  'Premium AI models (Claude, GPT-4.1, Gemini Pro, DeepSeek R1)',
  'Larger context windows (up to 1M tokens)',
  'Priority inference — no rate-limit queues',
  'Advanced reasoning & code generation',
  'Custom model fine-tuning support',
  'Priority support & SLA',
];

const cloudFeatures = [
  'Everything in Pro, plus:',
  'Fully managed — no cloning, no deploying, no DevOps',
  'Sign up and start chatting in 30 seconds',
  'Enterprise SSO (SAML, OIDC) & SCIM provisioning',
  'SOC 2 Type II & GDPR compliance',
  '99.9% uptime SLA with dedicated infrastructure',
  'Unlimited workspaces, users, and documents',
  'Custom data residency (US, EU, APAC)',
  'Dedicated support engineer & onboarding',
  'Volume discounts for large teams',
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 mb-6 text-sm font-medium border border-green-500/20">
          <Zap className="h-4 w-4" />
          <span>Open Source &middot; MIT License</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
          Free Forever.
          <br />
          <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            No Strings Attached.
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Self-host for free with the MIT-licensed codebase, or let us handle everything with Cloud.
          Your data, your rules — either way.
        </p>
      </div>

      {/* Three-Tier Pricing */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid gap-8 lg:grid-cols-3 md:grid-cols-2">
          {/* Free Tier */}
          <div className="rounded-2xl border-2 border-green-500/30 bg-card p-8 flex flex-col relative shadow-[0_0_60px_-15px_rgba(34,197,94,0.2)]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-green-500 text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
                Everything Included
              </span>
            </div>

            <div className="mb-6 mt-2">
              <h2 className="text-2xl font-bold text-foreground mb-2">Free</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Clone the repo, configure two free API keys, and deploy. No feature gates, no trial
                periods, no vendor lock-in.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-foreground">$0</span>
                <span className="text-muted-foreground pb-1">/ forever</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Free AI via OpenRouter + Google Gemini &middot; Run on your own infra
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 mt-auto">
              <Button asChild className="w-full rounded-xl h-11 bg-green-600 hover:bg-green-700">
                <Link
                  href="https://github.com/rejisterjack/rag-starter-kit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  Clone on GitHub
                  <span className="sr-only">(opens in new tab)</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-xl h-11">
                <Link href="/demo">Try the live demo first</Link>
              </Button>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="rounded-2xl border border-primary/30 bg-card p-8 flex flex-col relative shadow-[0_0_60px_-15px_rgba(99,102,241,0.15)]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full bg-primary text-primary-foreground border-0">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Coming Soon
              </Badge>
            </div>

            <div className="mb-6 mt-2">
              <h2 className="text-2xl font-bold text-foreground mb-2">Pro</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Premium AI models with superior reasoning, larger context windows, and priority
                inference. Currently in development.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-foreground">Pro</span>
                <span className="text-muted-foreground pb-1">/ coming soon</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Premium AI models (Claude, GPT-4.1, Gemini Pro, DeepSeek R1)
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              {proFeatures.map((f, i) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  {i === 0 ? (
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  )}
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 mt-auto">
              <Button
                asChild
                variant="outline"
                className="w-full rounded-xl h-11 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Link href="mailto:hello@ragstarterkit.com?subject=Pro%20Tier%20Interest">
                  <Mail className="mr-2 h-4 w-4" />
                  Notify Me at Launch
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Be the first to know when Pro launches
              </p>
            </div>
          </div>

          {/* Cloud Tier */}
          <div className="rounded-2xl border border-amber-500/30 bg-card p-8 flex flex-col relative shadow-[0_0_60px_-15px_rgba(245,158,11,0.15)] md:col-span-2 lg:col-span-1">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full bg-amber-500 text-white border-0">
                <Cloud className="mr-1.5 h-3.5 w-3.5" />
                Coming Soon
              </Badge>
            </div>

            <div className="mb-6 mt-2">
              <h2 className="text-2xl font-bold text-foreground mb-2">Cloud</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Fully managed RAG platform. Sign up, upload your docs, and start chatting. No
                infrastructure to manage, ever.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-foreground">Cloud</span>
                <span className="text-muted-foreground pb-1">/ coming soon</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Managed hosting, SSO, compliance, dedicated support
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              {cloudFeatures.map((f, i) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  {i === 0 ? (
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <Building2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 mt-auto">
              <Button
                asChild
                variant="outline"
                className="w-full rounded-xl h-11 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
              >
                <Link href="mailto:hello@ragstarterkit.com?subject=Cloud%20Tier%20Interest">
                  <Mail className="mr-2 h-4 w-4" />
                  Join the Waitlist
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Be the first to know when Cloud launches
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Options */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-10">Deploy Anywhere</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              name: 'Vercel',
              description: 'One-click deploy with serverless functions and edge caching.',
              href: 'https://vercel.com',
            },
            {
              name: 'Railway',
              description: 'Managed PostgreSQL and Redis included. Deploy in minutes.',
              href: 'https://railway.app',
            },
            {
              name: 'Docker',
              description: 'Self-contained deployment with docker-compose for full control.',
              href: 'https://github.com/rejisterjack/rag-starter-kit',
            },
          ].map((option) => (
            <div
              key={option.name}
              className="rounded-xl border border-border bg-card p-6 text-center"
            >
              <h3 className="font-bold text-foreground mb-2">{option.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{option.description}</p>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href={option.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Deploy
                  <span className="sr-only">(opens in new tab)</span>
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-8">
          {[
            {
              q: 'Is it really free?',
              a: 'Yes. The entire codebase is MIT-licensed. You clone it, deploy it to your own infrastructure, and owe nothing. The AI models it uses by default (OpenRouter free tier, Google Gemini free tier) are also free for development and moderate production usage.',
            },
            {
              q: 'What is the Pro tier?',
              a: 'Pro gives access to premium AI models like Claude Sonnet, GPT-4.1, Gemini 2.5 Pro, and DeepSeek R1 through OpenRouter. These models offer superior reasoning, larger context windows, and faster responses. Pro is currently in development.',
            },
            {
              q: 'What AI providers does it support?',
              a: 'By default it uses OpenRouter (free models: DeepSeek, Mistral, Llama, Gemma) for chat and Google Gemini for embeddings. You can switch to OpenAI, Anthropic Claude, or a self-hosted Ollama instance by changing a single environment variable.',
            },
            {
              q: 'Can I use this commercially?',
              a: 'Yes. The MIT license has no restrictions on commercial use. You can build products on top of it, charge your clients for it, and white-label the UI. The only requirement is that you retain the MIT license notice in the codebase.',
            },
            {
              q: 'Is there a hosted demo I can try?',
              a: 'Yes — click "Try the live demo first" above. It\'s a fully functional instance pre-loaded with project documentation. No sign-up required. Rate-limited to 20 requests per 15 minutes.',
            },
            {
              q: 'What is Cloud?',
              a: 'Cloud is a fully managed version of RAG Starter Kit. No cloning, no deploying, no DevOps. You sign up, create a workspace, upload your documents, and start chatting. It includes enterprise features like SSO, SOC 2 compliance, dedicated infrastructure, and custom data residency. Currently in development — join the waitlist to be notified.',
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
  );
}
