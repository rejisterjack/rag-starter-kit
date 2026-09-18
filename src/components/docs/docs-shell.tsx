/**
 * Docs shell wrapper: adds BreadcrumbList + TechArticle JSON-LD to any docs page.
 * Usage: wrap page content, or call the builder in a page's own layout.
 */

import Link from 'next/link';
import { buildBreadcrumbJsonLd, buildTechArticleJsonLd, JsonLd } from '@/components/seo';
import { getBreadcrumbTrail } from '@/lib/seo/content-registry';

interface DocsShellProps {
  path: string;
  title: string;
  description: string;
  lastModified: string;
  children: React.ReactNode;
}

export function DocsShell({ path, title, description, lastModified, children }: DocsShellProps) {
  const trail = getBreadcrumbTrail(path);

  return (
    <div>
      <JsonLd data={buildBreadcrumbJsonLd(path)} />
      <JsonLd
        data={buildTechArticleJsonLd({
          headline: title,
          description,
          path,
          datePublished: lastModified,
          dateModified: lastModified,
        })}
      />

      {trail.length > 1 && (
        <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
          {trail.map((entry, i) => (
            <span key={entry.path}>
              {i > 0 && (
                <span className="mx-2" aria-hidden="true">
                  /
                </span>
              )}
              {i === trail.length - 1 ? (
                <span className="text-foreground">{entry.title}</span>
              ) : (
                <Link href={entry.path} className="hover:text-foreground transition-colors">
                  {entry.title}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {children}
    </div>
  );
}
