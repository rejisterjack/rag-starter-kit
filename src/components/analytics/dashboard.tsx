'use client';

import { Activity, Clock, FileText, MessageSquare, Users, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricsCard } from './metrics-card';
import { RealtimeMonitor } from './realtime-monitor';
import { TimeSeriesChart } from './time-series-chart';
import { TopList } from './top-list';

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

function generateMockTimeSeries(range: string) {
  const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    users: Math.floor(Math.random() * 100) + 50,
    queries: Math.floor(Math.random() * 500) + 200,
    tokens: Math.floor(Math.random() * 10000) + 5000,
  }));
}

function generateMockData(range: string): AnalyticsData {
  return {
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
    timeSeriesData: generateMockTimeSeries(range),
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

      switch (timeRange) {
        case '24h':
          from.setHours(from.getHours() - 24);
          break;
        case '7d':
          from.setDate(from.getDate() - 7);
          break;
        case '30d':
          from.setDate(from.getDate() - 30);
          break;
        case '90d':
          from.setDate(from.getDate() - 90);
          break;
      }

      const granularity = timeRange === '24h' ? 'hour' : 'day';

      // Fetch metrics from API
      const response = await fetch(
        `/api/analytics/metrics?from=${from.toISOString()}&to=${to.toISOString()}&granularity=${granularity}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const result = await response.json();

      if (result.success) {
        const points = result.data.points || [];

        // Transform API data to component format
        const timeSeriesData = points.map(
          (point: {
            timestamp: string;
            users?: number;
            queries?: number;
            tokensTotal?: number;
          }) => ({
            date: point.timestamp.split('T')[0],
            users: point.users || 0,
            queries: point.queries || 0,
            tokens: point.tokensTotal || 0,
          })
        );

        // Calculate metrics
        const totalQueries = points.reduce(
          (sum: number, p: { queries?: number }) => sum + (p.queries || 0),
          0
        );
        const totalTokens = points.reduce(
          (sum: number, p: { tokensTotal?: number }) => sum + (p.tokensTotal || 0),
          0
        );
        const avgResponseTime =
          points.length > 0
            ? points.reduce((sum: number, p: { latency?: number }) => sum + (p.latency || 0), 0) /
              points.length /
              1000
            : 0;

        // Fetch additional stats
        const [usageRes] = await Promise.all([
          fetch('/api/analytics/usage'),
          //   fetch('/api/analytics/quality'),
        ]);

        let documentsCount = 0;
        let activeChatsCount = 0;

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          if (usageData.success) {
            documentsCount = usageData.data?.totalDocuments || 0;
            activeChatsCount = usageData.data?.activeChats || 0;
          }
        }

        setData({
          metrics: {
            totalUsers: points[points.length - 1]?.users || 0,
            activeChats: activeChatsCount,
            documentsProcessed: documentsCount,
            avgResponseTime: Number(avgResponseTime.toFixed(2)),
            totalQueries: totalQueries,
            tokensUsed: totalTokens,
          },
          trends: {
            users: { value: 12.5, isPositive: true },
            chats: { value: 8.2, isPositive: true },
            documents: { value: 23.1, isPositive: true },
            responseTime: { value: 5.4, isPositive: false },
            queries: { value: 15.3, isPositive: true },
            tokens: { value: 32.8, isPositive: true },
          },
          timeSeriesData:
            timeSeriesData.length > 0 ? timeSeriesData : generateMockTimeSeries(timeRange),
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
        });
      }
    } catch (_error) {
      toast.error('Failed to load analytics data');
      // Fall back to mock data
      setData(generateMockData(timeRange));
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
          {Array.from({ length: 6 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list with no reordering
            <div key={i} className="h-32 rounded-lg border bg-card animate-pulse" />
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
