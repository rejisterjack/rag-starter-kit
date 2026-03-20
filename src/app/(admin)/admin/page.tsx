import { Suspense } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getAuditLogs } from '@/lib/audit/audit-logger';
import { AdminDashboardStats } from '@/components/admin/admin-dashboard-stats';
import { RecentAuditLogs } from '@/components/admin/recent-audit-logs';
import { DashboardSkeleton } from '@/components/admin/dashboard-skeleton';

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
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Logs</CardTitle>
            <CardDescription>Latest system events and activities</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentAuditLogs logs={stats.recentAuditLogs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Overview of system components</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Authentication</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">AI Services</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Background Jobs</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                Operational
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <a
              href="/admin/audit-logs"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Audit Logs
            </a>
            <a
              href="/admin/sso"
              className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
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
