import type { Metadata } from 'next';
import Link from 'next/link';
import { generateSEO } from '@/components/seo';
import { getAllPosts } from '@/lib/blog';
import { SITE } from '@/lib/seo/content-registry';

export const dynamic = 'force-static';

export const metadata: Metadata = generateSEO({
  title: 'Blog — RAG Engineering Guides',
  description:
    'Practical guides on building production RAG systems: pgvector, retrieval quality, evaluation, and deployment.',
  url: '/blog',
  keywords: ['RAG', 'pgvector', 'Next.js', 'vector database', 'fine-tuning', 'AI engineering'],
});

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <header className="mb-14">
          <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
            Engineering Blog
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl mb-5">
            RAG, in production
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Practical guides on building retrieval-augmented systems with TypeScript and PostgreSQL
            — {SITE.name}.
          </p>
        </header>

        <div className="space-y-12">
          {posts.length === 0 ? (
            <p className="text-muted-foreground">No posts yet.</p>
          ) : (
            posts.map((post) => (
              <article key={post.slug} className="group">
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span>{post.readingMinutes} min read</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-3">{post.description}</p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="mt-16 pt-8 border-t border-border">
          <Link
            href="/docs/getting-started/quick-start"
            className="text-primary hover:underline font-medium"
          >
            Ready to build? Read the Quick Start →
          </Link>
        </footer>
      </div>
    </div>
  );
}
