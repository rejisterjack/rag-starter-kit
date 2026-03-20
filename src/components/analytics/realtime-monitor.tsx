'use client';

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  type LucideIcon,
  MessageSquare,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface RealtimeEvent {
  id: string;
  type: 'query' | 'response' | 'error' | 'user' | 'system';
  message: string;
  timestamp: Date;
  metadata?: Record<string, string | number>;
}

export interface RealtimeMetric {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export interface RealtimeMonitorProps {
  title?: string;
  description?: string;
  metrics: RealtimeMetric[];
  events: RealtimeEvent[];
  isConnected?: boolean;
  lastUpdated?: Date;
  maxEvents?: number;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const eventTypeConfig: Record<
  RealtimeEvent['type'],
  { icon: LucideIcon; color: string; label: string }
> = {
  query: { icon: MessageSquare, color: 'text-blue-500', label: 'Query' },
  response: { icon: CheckCircle2, color: 'text-green-500', label: 'Response' },
  error: { icon: AlertCircle, color: 'text-red-500', label: 'Error' },
  user: { icon: Users, color: 'text-purple-500', label: 'User' },
  system: { icon: Activity, color: 'text-orange-500', label: 'System' },
};

function ConnectionStatus({
  isConnected,
  lastUpdated,
}: {
  isConnected: boolean;
  lastUpdated?: Date;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2 w-2 rounded-full animate-pulse',
          isConnected ? 'bg-green-500' : 'bg-red-500'
        )}
      />
      <span className="text-xs text-muted-foreground">{isConnected ? 'Live' : 'Disconnected'}</span>
      {lastUpdated && isConnected && (
        <span className="text-xs text-muted-foreground">
          · Updated {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

function MetricCard({ metric }: { metric: RealtimeMetric }) {
  const Icon = metric.icon || Activity;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div
        className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center',
          metric.color ? '' : 'bg-background'
        )}
        style={metric.color ? { backgroundColor: `${metric.color}20` } : undefined}
      >
        <Icon
          className={cn('h-5 w-5', metric.color || 'text-muted-foreground')}
          style={metric.color ? { color: metric.color } : undefined}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold">{metric.value}</span>
          {metric.unit && <span className="text-xs text-muted-foreground">{metric.unit}</span>}
        </div>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: RealtimeEvent }) {
  const config = eventTypeConfig[event.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={cn('mt-0.5', config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {event.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm mt-1">{event.message}</p>
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(event.metadata).map(([key, value]) => (
              <span
                key={key}
                className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RealtimeMonitor({
  title = 'Real-time Monitor',
  description,
  metrics,
  events,
  isConnected = true,
  lastUpdated,
  maxEvents = 50,
  loading = false,
  onRefresh,
  className,
}: RealtimeMonitorProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Auto-scroll to bottom when new events arrive
  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [autoScroll]);

  // Handle scroll to toggle auto-scroll
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-32" />
              {description && <Skeleton className="h-4 w-48 mt-2" />}
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const displayEvents = events.slice(-maxEvents);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatus isConnected={isConnected} lastUpdated={lastUpdated} />
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>

        {/* Events Feed */}
        <div className="rounded-lg border">
          <div className="px-4 py-2 border-b bg-muted/50">
            <h4 className="text-sm font-medium">Recent Events</h4>
          </div>
          <ScrollArea className="h-64" ref={scrollRef} onScroll={handleScroll}>
            <div className="divide-y">
              {displayEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No events yet</p>
                </div>
              ) : (
                displayEvents.map((event) => <EventItem key={event.id} event={event} />)
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for simulating real-time data updates
export function useRealtimeData(options: { refreshInterval?: number; enabled?: boolean } = {}) {
  const { refreshInterval = 5000, enabled = true } = options;
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, enabled]);

  return { tick, refresh: () => setTick((t) => t + 1) };
}

export default RealtimeMonitor;
