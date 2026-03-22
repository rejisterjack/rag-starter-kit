'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Webhook,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Delivery {
  id: string;
  event: string;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  statusCode: number | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  error: string | null;
  response: string | null;
}

interface DeliveryStats {
  delivered: number;
  failed: number;
  pending: number;
  retrying: number;
}

interface DeliveriesResponse {
  success: boolean;
  data: {
    deliveries: Delivery[];
    total: number;
    stats: DeliveryStats;
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

const statusConfig = {
  DELIVERED: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Delivered' },
  FAILED: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  PENDING: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Pending' },
  RETRYING: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Retrying' },
};

export default function WebhookDeliveriesPage() {
  const params = useParams();
  const router = useRouter();
  const webhookId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeliveriesResponse['data'] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetchDeliveries = async () => {
    try {
      const url = new URL(`/api/webhooks/${webhookId}/deliveries`, window.location.origin);
      url.searchParams.set('limit', '50');
      url.searchParams.set('offset', offset.toString());
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);

      const response = await fetch(url);
      const result: DeliveriesResponse = await response.json();

      if (result.success) {
        setData((prev) =>
          offset === 0
            ? result.data
            : {
                ...result.data,
                deliveries: [...(prev?.deliveries || []), ...result.data.deliveries],
              }
        );
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [webhookId, statusFilter, offset]);

  const loadMore = () => {
    if (data?.pagination.hasMore) {
      setOffset((prev) => prev + 50);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Webhook Delivery Logs</h1>
          <p className="text-sm text-muted-foreground">
            View delivery history and troubleshoot failures
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Delivered"
            value={data.stats.delivered}
            icon={CheckCircle2}
            className="text-green-500"
          />
          <StatCard
            title="Failed"
            value={data.stats.failed}
            icon={AlertCircle}
            className="text-red-500"
          />
          <StatCard
            title="Pending"
            value={data.stats.pending}
            icon={Clock}
            className="text-yellow-500"
          />
          <StatCard
            title="Retrying"
            value={data.stats.retrying}
            icon={RefreshCw}
            className="text-blue-500"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RETRYING">Retrying</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {data?.total || 0} total deliveries
        </p>
      </div>

      {/* Deliveries List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Recent Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.deliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No deliveries found
            </div>
          ) : (
            data?.deliveries.map((delivery) => {
              const status = statusConfig[delivery.status];
              const StatusIcon = status.icon;
              const isExpanded = expandedId === delivery.id;

              return (
                <div
                  key={delivery.id}
                  className={cn(
                    'border rounded-lg p-4 transition-colors',
                    isExpanded && 'bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', status.bg)}>
                        <StatusIcon className={cn('h-4 w-4', status.color)} />
                      </div>
                      <div>
                        <p className="font-medium">{delivery.event}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(delivery.startedAt), {
                            addSuffix: true,
                          })}
                          {delivery.durationMs && ` • ${delivery.durationMs}ms`}
                          {delivery.statusCode && ` • HTTP ${delivery.statusCode}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={delivery.status === 'DELIVERED' ? 'default' : 'secondary'}>
                        {status.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setExpandedId(isExpanded ? null : delivery.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {delivery.error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <p className="text-sm font-medium text-red-500 mb-1">Error</p>
                          <p className="text-sm text-red-400 font-mono break-all">
                            {delivery.error}
                          </p>
                        </div>
                      )}
                      {delivery.response && (
                        <div>
                          <p className="text-sm font-medium mb-2">Response</p>
                          <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-40">
                            {delivery.response}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Delivery ID:</span>{' '}
                          <code className="bg-muted px-1 rounded">{delivery.id}</code>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Retry Count:</span>{' '}
                          {delivery.retryCount}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {data?.pagination.hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold', className)}>{value}</p>
          </div>
          <Icon className={cn('h-8 w-8 opacity-20', className)} />
        </div>
      </CardContent>
    </Card>
  );
}
