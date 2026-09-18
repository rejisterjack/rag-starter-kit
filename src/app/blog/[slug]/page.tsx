import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildBlogPostingJsonLd, generateSEO } from '@/components/seo';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { SITE } from '@/lib/seo/content-registry';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return generateSEO({
    title: post.title,
    description: post.description,
    url: `/blog/${post.slug}`,
    type: 'article',
    keywords: post.tags,
    author: post.author,
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBlogPostingJsonLd({
              headline: post.title,
              description: post.description,
              path: `/blog/${post.slug}`,
              datePublished: post.publishedAt,
              dateModified: post.updatedAt ?? post.publishedAt,
              keywords: post.tags,
              wordCount: post.wordCount,
            })
          ),
        }}
      />

      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <nav className="text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
          <Link href="/blog" className="hover:text-foreground transition-colors">
            Blog
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-foreground">{post.title}</span>
        </nav>

        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
            <span>{post.author}</span>
            <span aria-hidden="true">·</span>
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
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">{post.description}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
        </div>

        <footer className="mt-16 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Keep reading</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="block rounded-lg border border-border p-4 hover:border-primary transition-colors"
              >
                <div className="text-sm text-muted-foreground mb-1">
                  {p.readingMinutes} min read
                </div>
                <div className="font-medium text-foreground">{p.title}</div>
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-8">
            Built with the {SITE.name} —{' '}
            <Link href="/docs/getting-started/quick-start" className="text-primary hover:underline">
              read the Quick Start
            </Link>
            .
          </p>
        </footer>
      </article>
    </div>
  );
}
