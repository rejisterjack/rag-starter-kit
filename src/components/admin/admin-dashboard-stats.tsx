'use client';

import { FileText, MessageSquare, Users, Building2, TrendingUp } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 120 },
  },
};

function StatCard({ title, value, icon, trend }: StatCardProps): React.ReactElement {
  return (
    <motion.div variants={itemVariants}>
      <Card className="glass backdrop-blur-xl border-white/5 shadow-xl hover:shadow-primary/5 transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight text-muted-foreground/90">{title}</CardTitle>
          <div className="h-4 w-4 text-primary/70">{icon}</div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tracking-tight text-foreground/90">{value.toLocaleString()}</div>
          {trend && (
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-2">
              <span className="flex items-center text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{trend.value}
              </span>
              <span>{trend.label}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
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
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Members"
        value={totalUsers}
        icon={<Users className="h-5 w-5" />}
        trend={{ value: usersThisWeek, label: 'this week' }}
      />
      <StatCard
        title="Active Environments"
        value={totalWorkspaces}
        icon={<Building2 className="h-5 w-5" />}
        trend={{ value: workspacesThisWeek, label: 'this week' }}
      />
      <StatCard title="Synced Documents" value={totalDocuments} icon={<FileText className="h-5 w-5" />} />
      <StatCard title="Conversations" value={totalChats} icon={<MessageSquare className="h-5 w-5" />} />
    </motion.div>
  );
}
