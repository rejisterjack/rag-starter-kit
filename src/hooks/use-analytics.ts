'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

// Types
export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  workspaceId?: string;
  userId?: string;
}

export interface MetricsData {
  totalQueries: number;
  totalUsers: number;
  totalDocuments: number;
  avgResponseTime: number;
  totalTokens: number;
  totalCost: number;
  satisfactionScore: number;
  queriesTrend: number;
  usersTrend: number;
  documentsTrend: number;
  responseTimeTrend: number;
  tokensTrend: number;
  costTrend: number;
  satisfactionTrend: number;
}

export interface TimeSeriesPoint {
  date: string;
  queries: number;
  users: number;
  responseTime: number;
  tokens: number;
  cost: number;
  [key: string]: number | string;
}

export interface DistributionItem {
  name: string;
  value: number;
  color?: string;
}

export interface TopUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  queryCount: number;
  totalTokens: number;
}

export interface TopDocument {
  id: string;
  name: string;
  type: string;
  queryCount: number;
  chunkCount: number;
}

export interface TopQuery {
  id: string;
  query: string;
  count: number;
  avgResponseTime: number;
}

export interface RealtimeMetrics {
  activeUsers: number;
  queriesPerMinute: number;
  avgLatency: number;
  errorRate: number;
}

export interface RealtimeEvent {
  id: string;
  type: 'query' | 'response' | 'error' | 'user' | 'system';
  message: string;
  timestamp: Date;
  metadata?: Record<string, string | number>;
}

export interface AnalyticsData {
  metrics: MetricsData;
  timeSeries: TimeSeriesPoint[];
  queryTypes: DistributionItem[];
  toolUsage: DistributionItem[];
  documentFormats: DistributionItem[];
  topUsers: TopUser[];
  topDocuments: TopDocument[];
  topQueries: TopQuery[];
}

// API Functions
async function fetchAnalyticsOverview(filter: AnalyticsFilter): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (filter.startDate) params.set('startDate', filter.startDate.toISOString());
  if (filter.endDate) params.set('endDate', filter.endDate.toISOString());
  if (filter.workspaceId) params.set('workspaceId', filter.workspaceId);
  if (filter.userId) params.set('userId', filter.userId);

  const response = await fetch(`/api/analytics/overview?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch analytics overview');
  }
  return response.json();
}

async function fetchMetrics(filter: AnalyticsFilter): Promise<MetricsData> {
  const params = new URLSearchParams();
  if (filter.startDate) params.set('startDate', filter.startDate.toISOString());
  if (filter.endDate) params.set('endDate', filter.endDate.toISOString());

  const response = await fetch(`/api/analytics/metrics?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch metrics');
  }
  return response.json();
}

async function fetchTimeSeries(filter: AnalyticsFilter): Promise<TimeSeriesPoint[]> {
  const params = new URLSearchParams();
  if (filter.startDate) params.set('startDate', filter.startDate.toISOString());
  if (filter.endDate) params.set('endDate', filter.endDate.toISOString());

  const response = await fetch(`/api/analytics/timeseries?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch time series data');
  }
  return response.json();
}

async function fetchRealtimeMetrics(): Promise<RealtimeMetrics> {
  const response = await fetch('/api/analytics/realtime');
  if (!response.ok) {
    throw new Error('Failed to fetch realtime metrics');
  }
  return response.json();
}

async function fetchRealtimeEvents(): Promise<RealtimeEvent[]> {
  const response = await fetch('/api/analytics/events');
  if (!response.ok) {
    throw new Error('Failed to fetch realtime events');
  }
  return response.json();
}

// Query Keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (filter: AnalyticsFilter) => [...analyticsKeys.all, 'overview', filter] as const,
  metrics: (filter: AnalyticsFilter) => [...analyticsKeys.all, 'metrics', filter] as const,
  timeSeries: (filter: AnalyticsFilter) => [...analyticsKeys.all, 'timeseries', filter] as const,
  realtime: () => [...analyticsKeys.all, 'realtime'] as const,
  events: () => [...analyticsKeys.all, 'events'] as const,
};

// Hooks
export interface UseAnalyticsOptions {
  filter?: AnalyticsFilter;
  refreshInterval?: number;
  enabled?: boolean;
}

export function useAnalyticsOverview(options: UseAnalyticsOptions = {}) {
  const { filter = {}, refreshInterval = 60000, enabled = true } = options;

  return useQuery({
    queryKey: analyticsKeys.overview(filter),
    queryFn: () => fetchAnalyticsOverview(filter),
    refetchInterval: refreshInterval,
    enabled,
  });
}

export function useAnalyticsMetrics(options: UseAnalyticsOptions = {}) {
  const { filter = {}, refreshInterval = 60000, enabled = true } = options;

  return useQuery({
    queryKey: analyticsKeys.metrics(filter),
    queryFn: () => fetchMetrics(filter),
    refetchInterval: refreshInterval,
    enabled,
  });
}

export function useAnalyticsTimeSeries(options: UseAnalyticsOptions = {}) {
  const { filter = {}, refreshInterval = 60000, enabled = true } = options;

  return useQuery({
    queryKey: analyticsKeys.timeSeries(filter),
    queryFn: () => fetchTimeSeries(filter),
    refetchInterval: refreshInterval,
    enabled,
  });
}

export function useRealtimeAnalytics(
  options: { refreshInterval?: number; enabled?: boolean } = {}
) {
  const { refreshInterval = 5000, enabled = true } = options;

  const metricsQuery = useQuery({
    queryKey: analyticsKeys.realtime(),
    queryFn: fetchRealtimeMetrics,
    refetchInterval: refreshInterval,
    enabled,
  });

  const eventsQuery = useQuery({
    queryKey: analyticsKeys.events(),
    queryFn: fetchRealtimeEvents,
    refetchInterval: refreshInterval,
    enabled,
  });

  return {
    metrics: metricsQuery.data,
    events: eventsQuery.data || [],
    isLoading: metricsQuery.isLoading || eventsQuery.isLoading,
    isError: metricsQuery.isError || eventsQuery.isError,
    error: metricsQuery.error || eventsQuery.error,
    refetch: () => {
      metricsQuery.refetch();
      eventsQuery.refetch();
    },
  };
}

// Hook for manual refresh with loading state
export function useAnalyticsRefresh() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return { refresh, isRefreshing };
}

// Hook for analytics with filter state management
export function useAnalyticsWithFilter(initialFilter: AnalyticsFilter = {}) {
  const [filter, setFilter] = useState<AnalyticsFilter>(initialFilter);
  const [debouncedFilter, setDebouncedFilter] = useState<AnalyticsFilter>(initialFilter);

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
    }, 300);

    return () => clearTimeout(timer);
  }, [filter]);

  const updateFilter = useCallback((updates: Partial<AnalyticsFilter>) => {
    setFilter((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const { data, isLoading, isError, error, refetch } = useAnalyticsOverview({
    filter: debouncedFilter,
  });

  return {
    filter,
    debouncedFilter,
    updateFilter,
    resetFilter,
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// Hook for SSE-based realtime updates
export function useRealtimeEventsSSE(
  options: {
    enabled?: boolean;
    onEvent?: (event: RealtimeEvent) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const { enabled = true, onEvent, onError } = options;
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      setIsConnected(false);
      return;
    }

    const connect = () => {
      try {
        const es = new EventSource('/api/analytics/events/stream');
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
          setError(null);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as RealtimeEvent;
            setEvents((prev) => [...prev.slice(-49), data]);
            onEvent?.(data);
          } catch (_error: unknown) {}
        };

        es.onerror = () => {
          setIsConnected(false);
          const connectionError = new Error('Connection lost');
          setError(connectionError);
          onError?.(connectionError);
          es.close();

          // Reconnect after 5 seconds
          setTimeout(connect, 5000);
        };
      } catch (err) {
        const connectionError = err instanceof Error ? err : new Error('Failed to connect');
        setError(connectionError);
        onError?.(connectionError);
      }
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [enabled, onEvent, onError]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    isConnected,
    error,
    clearEvents,
  };
}

// Mock data generators for development
export function generateMockMetrics(): MetricsData {
  return {
    totalQueries: 15420,
    totalUsers: 342,
    totalDocuments: 1289,
    avgResponseTime: 1.24,
    totalTokens: 4523000,
    totalCost: 127.5,
    satisfactionScore: 4.6,
    queriesTrend: 12.5,
    usersTrend: 8.3,
    documentsTrend: -2.1,
    responseTimeTrend: -5.4,
    tokensTrend: 18.7,
    costTrend: 15.2,
    satisfactionTrend: 3.2,
  };
}

export function generateMockTimeSeries(days: number = 30): TimeSeriesPoint[] {
  const data: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split('T')[0],
      queries: Math.floor(Math.random() * 500) + 300,
      users: Math.floor(Math.random() * 100) + 50,
      responseTime: +(Math.random() * 2 + 0.5).toFixed(2),
      tokens: Math.floor(Math.random() * 100000) + 50000,
      cost: +(Math.random() * 10 + 5).toFixed(2),
    });
  }

  return data;
}

export function generateMockDistribution(): DistributionItem[] {
  return [
    { name: 'General Query', value: 450, color: 'hsl(var(--primary))' },
    { name: 'Document Search', value: 320, color: 'hsl(var(--secondary))' },
    { name: 'Code Analysis', value: 180, color: 'hsl(var(--accent))' },
    { name: 'Summarization', value: 150, color: 'hsl(var(--muted))' },
    { name: 'Other', value: 100, color: 'hsl(var(--destructive))' },
  ];
}

// Export default hook combining all analytics
export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const overview = useAnalyticsOverview(options);
  const timeSeries = useAnalyticsTimeSeries(options);
  const metrics = useAnalyticsMetrics(options);
  const refresh = useAnalyticsRefresh();

  return {
    overview: overview.data,
    timeSeries: timeSeries.data,
    metrics: metrics.data,
    isLoading: overview.isLoading || timeSeries.isLoading || metrics.isLoading,
    isError: overview.isError || timeSeries.isError || metrics.isError,
    error: overview.error || timeSeries.error || metrics.error,
    refresh: refresh.refresh,
    isRefreshing: refresh.isRefreshing,
  };
}

export default useAnalytics;
