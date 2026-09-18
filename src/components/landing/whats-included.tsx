import { Check, Minus } from 'lucide-react';

const corePlatform = [
  'RAG pipeline (ingest → chunk → embed → retrieve → generate)',
  'Streaming SSE responses',
  'Hybrid search (vector + keyword)',
  'Source citations in every answer',
  'Voice input + output (Whisper + Web Speech)',
  'Agent mode (web search, calculator, code execution)',
  'Chrome extension (save pages, ask about text, summarize)',
  'Multi-source ingestion (GitHub, Google Drive, Notion, Slack, YouTube)',
];

const infrastructure = [
  'Authentication (GitHub OAuth, Google OAuth, credentials, SAML SSO)',
  'Admin dashboard (upload, manage, delete docs)',
  'Background job processing (Inngest)',
  'Rate limiting (Upstash Redis)',
  'Analytics (PostHog + Plausible)',
  'Audit logging',
  'E2E tests (Playwright) + unit tests (Vitest)',
  'PWA support (installable, offline)',
  'One-click deploy (Vercel / Railway / Render)',
  'SAML 2.0 SSO for enterprise (Okta, Azure AD)',
];

export function WhatsIncluded(): React.ReactElement {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden bg-muted/10 border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
            What's <span className="text-gradient">Included</span>
          </h2>
          <p className="mt-4 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Everything you need to ship a production AI app, straight out of the box.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Core Platform */}
          <div
            className="glass-panel rounded-3xl p-8 border border-border animate-in fade-in slide-in-from-left-8 duration-700"
            style={{ animationDelay: '200ms' }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">1</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">Core AI Platform</h3>
            </div>
            <ul className="space-y-4">
              {corePlatform.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-500" />
                  </div>
                  <span className="text-muted-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Infrastructure */}
          <div
            className="glass-panel rounded-3xl p-8 border border-border animate-in fade-in slide-in-from-right-8 duration-700"
            style={{ animationDelay: '400ms' }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">2</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">Production Infrastructure</h3>
            </div>
            <ul className="space-y-4">
              {infrastructure.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-500" />
                  </div>
                  <span className="text-muted-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Out of scope */}
        <div
          className="mt-14 text-center animate-in fade-in slide-in-from-bottom-4 duration-700"
          style={{ animationDelay: '600ms' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-5">
            Deliberate exclusions
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Pricing models', 'No-code UI builder', 'Python backend', 'Kubernetes manifests'].map(
              (item) => (
                <div
                  key={item}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl glass-light border border-white/5 text-sm text-muted-foreground/80 font-medium hover:border-white/10 hover:text-muted-foreground transition-colors"
                >
                  <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />
                  {item}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
