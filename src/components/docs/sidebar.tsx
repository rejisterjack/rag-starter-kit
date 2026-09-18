'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

interface NavItem {
  label: string;
  href?: string;
  children?: NavItem[];
}

const navigation: { title: string; items: NavItem[] }[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Overview', href: '/docs/getting-started' },
      { label: 'Installation', href: '/docs/getting-started/installation' },
      { label: 'Configuration', href: '/docs/getting-started/configuration' },
      { label: 'Quick Start', href: '/docs/getting-started/quick-start' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { label: 'Overview', href: '/docs/api' },
      { label: 'Chat API', href: '/docs/api/chat' },
      { label: 'Documents API', href: '/docs/api/documents' },
      { label: 'Embeddings', href: '/docs/api/embeddings' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { label: 'Overview', href: '/docs/guides' },
      { label: 'Embedding Providers', href: '/docs/guides/embedding-providers' },
      { label: 'LLM Providers', href: '/docs/guides/llm-providers' },
      { label: 'Deployment', href: '/docs/guides/deployment' },
      { label: 'Authentication', href: '/docs/guides/authentication' },
      { label: 'Chrome Extension', href: '/docs/guides/chrome-extension' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Overview', href: '/docs/reference' },
      { label: 'Environment Variables', href: '/docs/reference/environment-variables' },
      { label: 'Database Schema', href: '/docs/reference/database-schema' },
      { label: 'RBAC Permissions', href: '/docs/reference/rbac-permissions' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/docs') return pathname === '/docs';
  return pathname === href;
}

function Section({
  title,
  items,
  pathname,
  collapsed,
  onToggle,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const hasActive = items.some((item) => item.href && isActive(pathname, item.href));

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={!collapsed}
      >
        {title}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          role="img"
          aria-label="Toggle section"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {!collapsed && (
        <ul className="space-y-0.5 ml-1">
          {items.map((item) => {
            if (!item.href) return null;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {collapsed && hasActive && (
        <ul className="space-y-0.5 ml-1">
          {items.map((item) => {
            if (!item.href || !isActive(pathname, item.href)) return null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-3 py-1.5 text-sm rounded-md bg-primary/10 text-primary font-medium transition-colors"
                  aria-current="page"
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DocsSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initialCollapsed = navigation.map((section) => {
    const hasActive = section.items.some((item) => item.href && isActive(pathname, item.href));
    return !hasActive;
  });
  const [collapsed, setCollapsed] = useState<boolean[]>(initialCollapsed);

  const toggleSection = useCallback((index: number) => {
    setCollapsed((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <Link
          href="/"
          className="text-lg font-bold text-foreground hover:text-primary transition-colors"
        >
          RAG Starter Kit
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Documentation navigation">
        <Link
          href="/docs"
          className={`block px-3 py-1.5 text-sm rounded-md mb-3 transition-colors ${
            pathname === '/docs'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Docs Home
        </Link>

        {navigation.map((section, index) => (
          <Section
            key={section.title}
            title={section.title}
            items={section.items}
            pathname={pathname}
            collapsed={collapsed[index] ?? false}
            onToggle={() => toggleSection(index)}
          />
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3 space-y-2">
        <Link
          href="/"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to App
        </Link>
        <a
          href="https://github.com/rejisterjack/rag-starter-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          GitHub Repository
          <span className="sr-only">(opens in new tab)</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-background border border-border shadow-sm hover:bg-accent transition-colors"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        {mobileOpen ? (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            role="img"
            aria-label="Close navigation"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            role="img"
            aria-label="Open navigation"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-40 h-full w-72 bg-background border-r border-border transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 z-30 h-full w-64 bg-background border-r border-border overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
}
