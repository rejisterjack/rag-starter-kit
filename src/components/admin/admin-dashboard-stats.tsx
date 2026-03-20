import { FileText, MessageSquare, Users, Building2, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminDashboardStatsProps {
  totalUsers: number;
  totalWorkspaces: number;
  totalDocuments: number;
  totalChats: number;
  usersThisWeek: number;
  workspacesThisWeek: number;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
}

function StatCard({ title, value, icon, trend }: StatCardProps): React.ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {trend && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-green-500">+{trend.value}</span>
            <span>{trend.label}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDashboardStats({
  totalUsers,
  totalWorkspaces,
  totalDocuments,
  totalChats,
  usersThisWeek,
  workspacesThisWeek,
}: AdminDashboardStatsProps): React.ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Users"
        value={totalUsers}
        icon={<Users className="h-4 w-4" />}
        trend={{ value: usersThisWeek, label: 'this week' }}
      />
      <StatCard
        title="Workspaces"
        value={totalWorkspaces}
        icon={<Building2 className="h-4 w-4" />}
        trend={{ value: workspacesThisWeek, label: 'this week' }}
      />
      <StatCard title="Documents" value={totalDocuments} icon={<FileText className="h-4 w-4" />} />
      <StatCard title="Chats" value={totalChats} icon={<MessageSquare className="h-4 w-4" />} />
    </div>
  );
}
