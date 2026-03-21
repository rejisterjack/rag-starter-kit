'use client';

import { useState, useEffect } from 'react';
import { MetricsCard } from './metrics-card';
import { TimeSeriesChart } from './time-series-chart';
import { TopList } from './top-list';
import { RealtimeMonitor } from './realtime-monitor';
import {
  Users,
  MessageSquare,
  FileText,
  Activity,
  Clock,
  Zap,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AnalyticsData {
  metrics: {
    totalUsers: number;
    activeChats: number;
    documentsProcessed: number;
    avgResponseTime: number;
    totalQueries: number;
    tokensUsed: number;
  };
  trends: {
    users: { value: number; isPositive: boolean };
    chats: { value: number; isPositive: boolean };
    documents: { value: number; isPositive: boolean };
    responseTime: { value: number; isPositive: boolean };
    queries: { value: number; isPositive: boolean };
    tokens: { value: number; isPositive: boolean };
  };
  timeSeriesData: Array<{
    date: string;
    users: number;
    queries: number;
    tokens: number;
  }>;
  topDocuments: Array<{
    name: string;
    queries: number;
    trend: number;
  }>;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    // Simulate fetching analytics data
    // In production, this would be an API call
    const fetchData = async () => {
      setIsLoading(true);
      
      // Mock data - replace with actual API call
      const mockData: AnalyticsData = {
        metrics: {
          totalUsers: 1234,
          activeChats: 56,
          documentsProcessed: 892,
          avgResponseTime: 1.2,
          totalQueries: 15234,
          tokensUsed: 4523412,
        },
        trends: {
          users: { value: 12.5, isPositive: true },
          chats: { value: 8.2, isPositive: true },
          documents: { value: 23.1, isPositive: true },
          responseTime: { value: 5.4, isPositive: false },
          queries: { value: 15.3, isPositive: true },
          tokens: { value: 32.8, isPositive: true },
        },
        timeSeriesData: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          users: Math.floor(Math.random() * 100) + 50,
          queries: Math.floor(Math.random() * 500) + 200,
          tokens: Math.floor(Math.random() * 10000) + 5000,
        })),
        topDocuments: [
          { name: 'Getting Started Guide.pdf', queries: 234, trend: 12 },
          { name: 'API Documentation.md', queries: 189, trend: 8 },
          { name: 'Project Requirements.docx', queries: 156, trend: -3 },
          { name: 'User Manual.pdf', queries: 134, trend: 15 },
          { name: 'Architecture Overview.md', queries: 98, trend: 5 },
        ],
        topQueries: [
          { query: 'How to authenticate?', count: 456 },
          { query: 'What is RAG?', count: 389 },
          { query: 'How to upload documents?', count: 345 },
          { query: 'API rate limits', count: 234 },
          { query: 'Supported file formats', count: 198 },
        ],
      };

      setData(mockData);
      setIsLoading(false);
    };

    fetchData();
  }, [timeRange]);

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-lg border bg-card animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your RAG chatbot performance and usage
          </p>
        </div>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList>
            <TabsTrigger value="24h">24h</TabsTrigger>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
            <TabsTrigger value="90d">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricsCard
          title="Total Users"
          value={data.metrics.totalUsers.toLocaleString()}
          trend={data.trends.users}
          icon={Users}
        />
        <MetricsCard
          title="Active Chats"
          value={data.metrics.activeChats.toLocaleString()}
          trend={data.trends.chats}
          icon={MessageSquare}
        />
        <MetricsCard
          title="Documents Processed"
          value={data.metrics.documentsProcessed.toLocaleString()}
          trend={data.trends.documents}
          icon={FileText}
        />
        <MetricsCard
          title="Avg Response Time"
          value={`${data.metrics.avgResponseTime}s`}
          description="Target: < 2s"
          trend={data.trends.responseTime}
          icon={Clock}
        />
        <MetricsCard
          title="Total Queries"
          value={data.metrics.totalQueries.toLocaleString()}
          trend={data.trends.queries}
          icon={Activity}
        />
        <MetricsCard
          title="Tokens Used"
          value={`${(data.metrics.tokensUsed / 1000000).toFixed(2)}M`}
          trend={data.trends.tokens}
          icon={Zap}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TimeSeriesChart
          data={data.timeSeriesData}
          title="Usage Over Time"
          description="Daily active users and query volume"
        />
        <RealtimeMonitor />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopList
          title="Top Documents"
          items={data.topDocuments.map((doc) => ({
            label: doc.name,
            value: `${doc.queries} queries`,
            trend: doc.trend,
          }))}
          description="Most queried documents"
        />
        <TopList
          title="Top Queries"
          items={data.topQueries.map((q) => ({
            label: q.query,
            value: `${q.count} times`,
          }))}
          description="Most frequent user questions"
        />
      </div>
    </div>
  );
}
