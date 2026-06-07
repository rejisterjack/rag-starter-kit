'use client';

import { Activity, Clock, FileText, MessageSquare, Users, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricsCard } from './metrics-card';
import { RealtimeMonitor } from './realtime-monitor';
import { TopList } from './top-list';

const TimeSeriesChart = dynamic(
  () => import('./time-series-chart').then((m) => ({ default: m.TimeSeriesChart })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" />,
  }
);

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

function generateEmptyData(): AnalyticsData {
  return {
    metrics: {
      totalUsers: 0,
      activeChats: 0,
      documentsProcessed: 0,
      avgResponseTime: 0,
      totalQueries: 0,
      tokensUsed: 0,
    },
    trends: {
      users: { value: 0, isPositive: true },
      chats: { value: 0, isPositive: true },
      documents: { value: 0, isPositive: true },
      responseTime: { value: 0, isPositive: true },
      queries: { value: 0, isPositive: true },
      tokens: { value: 0, isPositive: true },
    },
    timeSeriesData: [],
    topDocuments: [],
    topQueries: [],
  };
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');

  const fetchAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date range based on timeRange
      const to = new Date();
      const from = new Date();
      const prevFrom = new Date();

      switch (timeRange) {
        case '24h':
          from.setHours(from.getHours() - 24);
          prevFrom.setHours(prevFrom.getHours() - 48);
          break;
        case '7d':
          from.setDate(from.getDate() - 7);
          prevFrom.setDate(prevFrom.getDate() - 14);
          break;
        case '30d':
          from.setDate(from.getDate() - 30);
          prevFrom.setDate(prevFrom.getDate() - 60);
          break;
        case '90d':
          from.setDate(from.getDate() - 90);
          prevFrom.setDate(prevFrom.getDate() - 180);
          break;
      }

      const granularity = timeRange === '24h' ? 'hour' : 'day';

      // Fetch current period metrics + usage + previous period for trends
      const [metricsRes, usageRes, prevMetricsRes] = await Promise.all([
        fetch(
          `/api/analytics/metrics?from=${from.toISOString()}&to=${to.toISOString()}&granularity=${granularity}`
        ),
        fetch(`/api/analytics/usage?from=${from.toISOString()}&to=${to.toISOString()}`),
        fetch(
          `/api/analytics/metrics?from=${prevFrom.toISOString()}&to=${from.toISOString()}&granularity=${granularity}`
        ).catch(() => null),
      ]);

      if (!metricsRes.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const result = await metricsRes.json();

      if (result.success) {
        const points = result.data.points || [];

        // Transform API data to component format
        const timeSeriesData = points.map(
          (point: {
            timestamp: string;
            chatCount?: number;
            tokenUsage?: number;
            latency?: number;
          }) => ({
            date: point.timestamp.split('T')[0],
            users: point.chatCount || 0,
            queries: point.chatCount || 0,
            tokens: point.tokenUsage || 0,
          })
        );

        // Calculate metrics from time series
        const totalQueries = points.reduce(
          (sum: number, p: { chatCount?: number }) => sum + (p.chatCount || 0),
          0
        );
        const totalTokens = points.reduce(
          (sum: number, p: { tokenUsage?: number }) => sum + (p.tokenUsage || 0),
          0
        );
        const avgResponseTime =
          points.length > 0
            ? points.reduce((sum: number, p: { latency?: number }) => sum + (p.latency || 0), 0) /
              points.length /
              1000
            : 0;

        // Parse usage data for document/chat counts
        let documentsCount = 0;
        let activeChatsCount = 0;
        let topDocuments: Array<{ name: string; queries: number; trend: number }> = [];

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          if (usageData.success) {
            const usage = usageData.data;
            activeChatsCount = usage?.totalChats || 0;
            documentsCount = usage?.activeDocuments?.length || 0;
            topDocuments = (usage?.activeDocuments || [])
              .slice(0, 5)
              .map((doc: { documentName: string; queryCount: number }) => ({
                name: doc.documentName,
                queries: doc.queryCount,
                trend: 0,
              }));
          }
        }

        // Calculate trends by comparing with previous period
        let prevTotalQueries = 0;
        let prevTotalTokens = 0;
        let prevAvgLatency = 0;

        if (prevMetricsRes?.ok) {
          const prevResult = await prevMetricsRes.json();
          if (prevResult.success) {
            const prevPoints = prevResult.data.points || [];
            prevTotalQueries = prevPoints.reduce(
              (sum: number, p: { chatCount?: number }) => sum + (p.chatCount || 0),
              0
            );
            prevTotalTokens = prevPoints.reduce(
              (sum: number, p: { tokenUsage?: number }) => sum + (p.tokenUsage || 0),
              0
            );
            prevAvgLatency =
              prevPoints.length > 0
                ? prevPoints.reduce(
                    (sum: number, p: { latency?: number }) => sum + (p.latency || 0),
                    0
                  ) /
                  prevPoints.length /
                  1000
                : 0;
          }
        }

        const calcTrend = (current: number, previous: number) => {
          if (previous === 0) return { value: 0, isPositive: current > 0 };
          const change = ((current - previous) / previous) * 100;
          return { value: Math.abs(Math.round(change * 10) / 10), isPositive: change >= 0 };
        };

        setData({
          metrics: {
            totalUsers: points[points.length - 1]?.chatCount || 0,
            activeChats: activeChatsCount,
            documentsProcessed: documentsCount,
            avgResponseTime: Number(avgResponseTime.toFixed(2)),
            totalQueries: totalQueries,
            tokensUsed: totalTokens,
          },
          trends: {
            users: calcTrend(points.length, prevMetricsRes ? 1 : 0),
            chats: calcTrend(activeChatsCount, 0),
            documents: calcTrend(documentsCount, 0),
            responseTime: {
              value: Math.abs(
                Math.round(((avgResponseTime - prevAvgLatency) / (prevAvgLatency || 1)) * 1000) / 10
              ),
              isPositive: avgResponseTime <= prevAvgLatency,
            },
            queries: calcTrend(totalQueries, prevTotalQueries),
            tokens: calcTrend(totalTokens, prevTotalTokens),
          },
          timeSeriesData,
          topDocuments,
          topQueries: [],
        });
      }
    } catch (_error: unknown) {
      toast.error('Failed to load analytics data');
      setData(generateEmptyData());
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {['metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'].map((k) => (
            <div key={k} className="h-32 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detailed Analytics</h2>
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
