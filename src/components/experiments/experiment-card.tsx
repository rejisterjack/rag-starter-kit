'use client';

import { formatDistanceToNow } from 'date-fns';
import { BarChart3, MoreHorizontal, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ExperimentVariant {
  id: string;
  name: string;
  config: Record<string, unknown>;
  trafficPercentage: number;
  metrics: {
    conversions: number;
    total: number;
    rate: number;
  };
}

interface Experiment {
  id: string;
  name: string;
  description?: string;
  type: 'prompt' | 'model' | 'retrieval' | 'ui';
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  variants: ExperimentVariant[];
  totalTraffic: number;
  createdAt: Date;
}

interface ExperimentCardProps {
  experiment: Experiment;
  onStart: (id: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onViewResults: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function ExperimentCard({
  experiment,
  onStart,
  onPause,
  onStop,
  onViewResults,
  onEdit,
  onDelete,
  className,
}: ExperimentCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const getStatusBadge = (status: Experiment['status']) => {
    const variants: Record<typeof status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      running: 'default',
      paused: 'outline',
      completed: 'secondary',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getTypeIcon = (type: Experiment['type']) => {
    switch (type) {
      case 'prompt':
        return '💬';
      case 'model':
        return '🤖';
      case 'retrieval':
        return '🔍';
      case 'ui':
        return '🎨';
      default:
        return '🧪';
    }
  };

  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true);
    try {
      await action();
    } catch (_error) {
      toast.error('Action failed');
    } finally {
      setIsLoading(false);
    }
  };

  const winningVariant = experiment.variants.reduce((best, current) =>
    current.metrics.rate > best.metrics.rate ? current : best
  );

  return (
    <Card className={cn('group', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getTypeIcon(experiment.type)}</span>
            <div>
              <CardTitle className="text-base">{experiment.name}</CardTitle>
              <CardDescription>
                {experiment.status === 'running' && experiment.startDate ? (
                  <>Running for {formatDistanceToNow(experiment.startDate)}</>
                ) : (
                  <>Created {formatDistanceToNow(experiment.createdAt)} ago</>
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge(experiment.status)}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewResults(experiment.id)}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Results
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(experiment.id)}>Edit</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(experiment.id)}
                    className="text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {experiment.description && (
          <p className="text-sm text-muted-foreground">{experiment.description}</p>
        )}

        {/* Variants */}
        <div className="space-y-2">
          {experiment.variants.map((variant) => (
            <div key={variant.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span
                  className={cn(
                    variant.id === winningVariant.id &&
                      experiment.status !== 'draft' &&
                      'font-medium'
                  )}
                >
                  {variant.name}
                  {variant.id === winningVariant.id && experiment.status !== 'draft' && (
                    <span className="ml-1 text-green-500">★</span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {variant.trafficPercentage}% • {variant.metrics.rate.toFixed(1)}%
                </span>
              </div>
              <Progress value={variant.trafficPercentage} className="h-2" />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {experiment.status === 'draft' && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleAction(() => onStart(experiment.id))}
              disabled={isLoading}
            >
              <Play className="mr-1 h-4 w-4" />
              Start
            </Button>
          )}

          {experiment.status === 'running' && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleAction(() => onPause(experiment.id))}
              disabled={isLoading}
            >
              <Square className="mr-1 h-4 w-4" />
              Pause
            </Button>
          )}

          {experiment.status === 'paused' && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleAction(() => onStart(experiment.id))}
              disabled={isLoading}
            >
              <Play className="mr-1 h-4 w-4" />
              Resume
            </Button>
          )}

          {(experiment.status === 'running' || experiment.status === 'paused') && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => handleAction(() => onStop(experiment.id))}
              disabled={isLoading}
            >
              Complete
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={() => onViewResults(experiment.id)}>
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats Summary */}
        {experiment.status !== 'draft' && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center">
              <p className="text-lg font-semibold">{experiment.totalTraffic.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-green-600">
                {winningVariant.metrics.rate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Best Rate</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{experiment.variants.length}</p>
              <p className="text-xs text-muted-foreground">Variants</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ExperimentCard;
