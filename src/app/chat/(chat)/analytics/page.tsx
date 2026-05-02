'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AnalyticsDashboard } from '@/components/analytics/dashboard';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsSummary {
  totalChats: number;
  totalMessages: number;
  totalDocuments: number;
  totalQueries: number;
  avgResponseTime: number;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export default function AnalyticsPage(): React.ReactElement {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyticsSummary = useCallback(async () => {
    try {
      // Get date range for last 30 days
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch metrics from API
      const response = await fetch(`/api/analytics/metrics?from=${from}&to=${to}&granularity=day`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();

      if (data.success) {
        // Calculate summary from time series data
        const points = data.data.points || [];
        const summary: AnalyticsSummary = {
          totalChats: points.reduce(
            (sum: number, p: { chats?: number }) => sum + (p.chats || 0),
            0
          ),
          totalMessages: points.reduce(
            (sum: number, p: { messages?: number }) => sum + (p.messages || 0),
            0
          ),
          totalDocuments: points.reduce(
            (sum: number, p: { documents?: number }) => sum + (p.documents || 0),
            0
          ),
          totalQueries: points.reduce(
            (sum: number, p: { queries?: number }) => sum + (p.queries || 0),
            0
          ),
          avgResponseTime:
            points.length > 0
              ? points.reduce((sum: number, p: { latency?: number }) => sum + (p.latency || 0), 0) /
                points.length
              : 0,
          tokensUsed: {
            prompt: points.reduce(
              (sum: number, p: { tokensPrompt?: number }) => sum + (p.tokensPrompt || 0),
              0
            ),
            completion: points.reduce(
              (sum: number, p: { tokensCompletion?: number }) => sum + (p.tokensCompletion || 0),
              0
            ),
            total: points.reduce(
              (sum: number, p: { tokensTotal?: number }) => sum + (p.tokensTotal || 0),
              0
            ),
          },
        };
        setSummary(summary);
      }
    } catch (_error: unknown) {
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsSummary();
  }, [fetchAnalyticsSummary]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track your chat usage and document processing metrics.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Chats</CardDescription>
            <CardTitle className="text-3xl">{summary?.totalChats.toLocaleString() || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Documents Processed</CardDescription>
            <CardTitle className="text-3xl">
              {summary?.totalDocuments.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Queries</CardDescription>
            <CardTitle className="text-3xl">
              {summary?.totalQueries.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tokens Used</CardDescription>
            <CardTitle className="text-3xl">
              {summary?.tokensUsed.total
                ? `${(summary.tokensUsed.total / 1000000).toFixed(2)}M`
                : '0'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Detailed Analytics Dashboard */}
      <AnalyticsDashboard />
    </div>
  );
}
