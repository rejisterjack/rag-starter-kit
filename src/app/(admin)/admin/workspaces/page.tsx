import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

import { WorkspaceLimitsForm } from '@/components/admin/workspaces/workspace-limits-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';

// =============================================================================
// Data Fetching
// =============================================================================

interface WorkspaceWithUsage {
  id: string;
  name: string;
  slug: string;
  maxDocuments: number;
  maxStorageMb: number;
  maxChats: number;
  maxChatPerDay: number;
  llmProvider: string | null;
  llmModel: string | null;
  _count: {
    documents: number;
    chats: number;
  };
  storageUsed: number;
  chatsToday: number;
}

async function getWorkspacesWithUsage(): Promise<WorkspaceWithUsage[]> {
  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      maxDocuments: true,
      maxStorageMb: true,
      maxChats: true,
      maxChatPerDay: true,
      llmProvider: true,
      llmModel: true,
      _count: {
        select: {
          documents: true,
          chats: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get storage usage and today's chat count for each workspace
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const enriched = await Promise.all(
    workspaces.map(async (ws) => {
      const [storageResult, chatsToday] = await Promise.all([
        prisma.document.aggregate({
          where: { workspaceId: ws.id },
          _sum: { size: true },
        }),
        prisma.chat.count({
          where: {
            workspaceId: ws.id,
            createdAt: { gte: startOfDay },
          },
        }),
      ]);

      return {
        ...ws,
        storageUsed: storageResult._sum.size ?? 0,
        chatsToday,
      };
    })
  );

  return enriched;
}

// =============================================================================
// Helper Components
// =============================================================================

function UsageBar({ current, limit, label }: { current: number; limit: number; label: string }) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={`font-mono ${isCritical ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-foreground/70'}`}
        >
          {current.toLocaleString()}/{limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

// =============================================================================
// Content Component
// =============================================================================

async function WorkspacesContent() {
  const workspaces = await getWorkspacesWithUsage();

  if (workspaces.length === 0) {
    return (
      <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No workspaces found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {workspaces.map((ws) => (
        <Card key={ws.id} className="glass backdrop-blur-xl border-white/5 shadow-2xl">
          <CardHeader className="border-b border-border/40 pb-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                  {ws.name}
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-1">{ws.slug}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {ws.llmProvider && (
                  <span className="inline-flex items-center rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                    {ws.llmProvider}
                  </span>
                )}
                {ws.llmModel && (
                  <span className="inline-flex items-center rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
                    {ws.llmModel}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {/* Usage Bars */}
            <div className="grid gap-4 md:grid-cols-2">
              <UsageBar current={ws._count.documents} limit={ws.maxDocuments} label="Documents" />
              <UsageBar
                current={Math.round(ws.storageUsed / (1024 * 1024))}
                limit={ws.maxStorageMb}
                label={`Storage (${formatBytes(ws.storageUsed)})`}
              />
              <UsageBar current={ws._count.chats} limit={ws.maxChats} label="Total Chats" />
              <UsageBar current={ws.chatsToday} limit={ws.maxChatPerDay} label="Chats Today" />
            </div>

            {/* Limits Form */}
            <div className="pt-4 border-t border-border/30">
              <WorkspaceLimitsForm workspaceId={ws.id} workspace={ws} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function WorkspacesSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="glass backdrop-blur-xl border-white/5 shadow-2xl">
          <CardHeader>
            <div className="h-6 w-48 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-white/5 rounded-lg animate-pulse mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="space-y-2">
                  <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
                  <div className="h-2 bg-white/5 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function AdminWorkspacesPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
        <p className="text-muted-foreground mt-2">
          Manage workspace resource limits and LLM configuration
        </p>
      </div>

      <Suspense fallback={<WorkspacesSkeleton />}>
        <WorkspacesContent />
      </Suspense>
    </div>
  );
}
