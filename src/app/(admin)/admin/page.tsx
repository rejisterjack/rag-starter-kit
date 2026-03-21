import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

import { AdminDashboardStats } from '@/components/admin/admin-dashboard-stats';
import { DashboardSkeleton } from '@/components/admin/dashboard-skeleton';
import { RecentAuditLogs } from '@/components/admin/recent-audit-logs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuditLogs } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';

// =============================================================================
// Server Functions
// =============================================================================

async function getDashboardStats() {
  const [
    totalUsers,
    totalWorkspaces,
    totalDocuments,
    totalChats,
    recentAuditLogs,
    usersThisWeek,
    workspacesThisWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.document.count(),
    prisma.chat.count(),
    getAuditLogs({ limit: 10 }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.workspace.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    totalUsers,
    totalWorkspaces,
    totalDocuments,
    totalChats,
    recentAuditLogs: recentAuditLogs.logs,
    usersThisWeek,
    workspacesThisWeek,
  };
}

// =============================================================================
// Dashboard Content Component
// =============================================================================

async function DashboardContent() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <AdminDashboardStats
        totalUsers={stats.totalUsers}
        totalWorkspaces={stats.totalWorkspaces}
        totalDocuments={stats.totalDocuments}
        totalChats={stats.totalChats}
        usersThisWeek={stats.usersThisWeek}
        workspacesThisWeek={stats.workspacesThisWeek}
      />

      {/* Recent Activity */}
      <div className="grid gap-8 lg:grid-cols-2 mt-8">
        <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
          <CardHeader className="border-b border-border/40 pb-4 mb-4">
            <CardTitle className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Recent Audit Logs
            </CardTitle>
            <CardDescription className="font-medium text-muted-foreground">
              Latest system events and activities
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <RecentAuditLogs logs={stats.recentAuditLogs} />
          </CardContent>
        </Card>

        <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl h-fit">
          <CardHeader className="border-b border-border/40 pb-4 mb-4">
            <CardTitle className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              System Health
            </CardTitle>
            <CardDescription className="font-medium text-muted-foreground">
              Overview of system components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            {[
              { name: 'Database', status: 'Operational' },
              { name: 'Authentication', status: 'Operational' },
              { name: 'AI Services', status: 'Operational' },
              { name: 'Background Jobs', status: 'Operational' },
            ].map((system) => (
              <div
                key={system.name}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
              >
                <span className="text-sm font-semibold tracking-tight text-foreground/90">
                  {system.name}
                </span>
                <span className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400 shadow-sm">
                  {system.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl mt-8">
        <CardHeader className="border-b border-border/40 pb-4 mb-4">
          <CardTitle className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            Quick Actions
          </CardTitle>
          <CardDescription className="font-medium text-muted-foreground">
            Common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-wrap gap-4">
            <a
              href="/admin/audit-logs"
              className="inline-flex items-center justify-center rounded-full bg-primary/90 px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
            >
              View Audit Logs
            </a>
            <a
              href="/admin/sso"
              className="inline-flex items-center justify-center rounded-full bg-white/10 border border-white/10 px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-white/20 shadow-lg transition-all hover:-translate-y-0.5"
            >
              Manage SSO
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function AdminDashboardPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your RAG Starter Kit instance</p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
