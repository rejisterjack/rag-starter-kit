import { Star } from 'lucide-react';

const STAR_KEYS = ['s1', 's2', 's3', 's4', 's5'] as const;

const TESTIMONIALS = [
  {
    name: 'Sarah K.',
    role: 'Engineering Lead, Series B Startup',
    quote:
      'We went from zero to a production RAG chatbot in a weekend. The TypeScript stack meant our whole team could contribute immediately.',
    stars: 5,
  },
  {
    name: 'Marcus T.',
    role: 'Senior Developer, Consulting Firm',
    quote:
      "Finally a RAG kit that doesn't require Python. The pgvector integration is rock solid and the multi-provider AI support saved us weeks.",
    stars: 5,
  },
  {
    name: 'Priya R.',
    role: 'CTO, LegalTech Company',
    quote:
      'The built-in RBAC, audit logging, and GDPR tools meant we could deploy to enterprise clients without building compliance from scratch.',
    stars: 5,
  },
];

const SHOWCASE_ITEMS = [
  {
    name: 'Internal Knowledge Base',
    description: 'Deployed for 500+ employees to search company docs',
  },
  {
    name: 'Legal Document Analysis',
    description: 'Law firm using it for contract Q&A with citations',
  },
  {
    name: 'Customer Support Bot',
    description: 'E-commerce site answering product questions from manuals',
  },
  { name: 'Research Assistant', description: 'Academic team searching through published papers' },
];

export function Testimonials(): React.ReactElement {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/10">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Trusted by Developers</h2>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Teams shipping production RAG systems with RAG Starter Kit
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-16">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-border/50 bg-card p-6 hover:border-primary/30 transition-colors"
            >
              <div className="flex gap-0.5 mb-3">
                {STAR_KEYS.slice(0, t.stars).map((sk) => (
                  <Star
                    key={`${t.name}-${sk}`}
                    className="h-4 w-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 mb-4">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold">Built with RAG Starter Kit</h3>
          <p className="text-sm text-muted-foreground mt-1">
            See how teams are using it in production
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHOWCASE_ITEMS.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border border-border/40 bg-background p-4 hover:border-primary/20 transition-colors"
            >
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Built something with RAG Starter Kit?{' '}
          <a
            href="https://github.com/rejisterjack/rag-starter-kit/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Share your project
            <span className="sr-only">(opens in new tab)</span>
          </a>
        </p>
      </div>
    </section>
  );
}
