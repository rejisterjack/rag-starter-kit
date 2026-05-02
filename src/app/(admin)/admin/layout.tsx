import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { ErrorBoundary } from '@/components/error/error-boundary';
import { requireAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const metadata: Metadata = {
  title: 'Admin | RAG Starter Kit',
  description: 'Admin panel for managing the RAG Starter Kit',
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  try {
    await requireAdmin();
  } catch (error: unknown) {
    logger.warn('Admin access denied, redirecting', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    redirect('/');
  }

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-primary/30">
      {/* Immersive ambient background */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-background bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
        <div className="absolute -left-[10%] top-[20%] h-[50%] w-[30%] rounded-[100%] bg-blue-600/10 opacity-30 blur-[150px] mix-blend-screen" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Floating Glass Sidebar Navigation */}
        <aside className="hidden lg:flex w-72 flex-col m-4 mr-0 rounded-3xl glass border border-white/5 shadow-2xl backdrop-blur-2xl">
          <div className="p-8 border-b border-border/40">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Overview
            </h1>
            <p className="text-sm text-primary/80 mt-1 font-medium tracking-wide">Command Center</p>
          </div>
          <nav className="flex-1 p-6 space-y-3 overflow-y-auto scrollbar-thin">
            <AdminNav />
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-screen overflow-y-auto">
          <ErrorBoundary>
            <div className="container mx-auto p-8 lg:p-12 max-w-7xl">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
