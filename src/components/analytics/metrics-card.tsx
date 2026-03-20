'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface MetricData {
  value: number | string;
  label: string;
  trend?: number;
  trendLabel?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export interface MetricsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
  description?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  loading?: boolean;
  sparklineData?: number[];
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantStyles = {
  default: '',
  success: 'border-green-200 dark:border-green-800',
  warning: 'border-yellow-200 dark:border-yellow-800',
  danger: 'border-red-200 dark:border-red-800',
  info: 'border-blue-200 dark:border-blue-800',
};

function Sparkline({
  data,
  trend,
  className,
}: {
  data: number[];
  trend?: number;
  className?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 24;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const strokeColor =
    trend === undefined
      ? 'hsl(var(--muted-foreground))'
      : trend >= 0
        ? 'hsl(142, 76%, 36%)'
        : 'hsl(0, 84%, 60%)';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-16 h-6', className)}
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        points={points.join(' ')}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].split(',')[0]}
        cy={points[points.length - 1].split(',')[1]}
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}

function formatValue(
  value: number | string,
  options: { prefix?: string; suffix?: string; decimals?: number } = {}
): string {
  const { prefix = '', suffix = '', decimals } = options;

  let formatted: string;
  if (typeof value === 'number') {
    if (decimals !== undefined) {
      formatted = value.toFixed(decimals);
    } else if (value >= 1000000) {
      formatted = `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      formatted = `${(value / 1000).toFixed(1)}K`;
    } else {
      formatted = value.toString();
    }
  } else {
    formatted = value;
  }

  return `${prefix}${formatted}${suffix}`;
}

function TrendIndicator({ trend, trendLabel }: { trend: number; trendLabel?: string }) {
  const isPositive = trend > 0;
  const isNeutral = trend === 0;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center text-xs font-medium',
          isPositive && 'text-green-600 dark:text-green-400',
          isNeutral && 'text-muted-foreground',
          !isPositive && !isNeutral && 'text-red-600 dark:text-red-400'
        )}
      >
        {isPositive && <ArrowUp className="h-3 w-3 mr-0.5" />}
        {isNeutral && <Minus className="h-3 w-3 mr-0.5" />}
        {!isPositive && !isNeutral && <ArrowDown className="h-3 w-3 mr-0.5" />}
        {Math.abs(trend).toFixed(1)}%
      </span>
      {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
    </div>
  );
}

export function MetricsCard({
  title,
  value,
  trend,
  trendLabel,
  description,
  prefix,
  suffix,
  decimals,
  loading = false,
  sparklineData,
  icon,
  variant = 'default',
  className,
  ...props
}: MetricsCardProps) {
  if (loading) {
    return (
      <Card className={cn(variantStyles[variant], className)} {...props}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(variantStyles[variant], className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && (
          <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight">
              {formatValue(value, { prefix, suffix, decimals })}
            </div>
            {trend !== undefined && <TrendIndicator trend={trend} trendLabel={trendLabel} />}
            {description && !trend && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <Sparkline data={sparklineData} trend={trend} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsCardGroup({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
}) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  return <div className={cn('grid gap-4', gridCols[columns], className)}>{children}</div>;
}

export default MetricsCard;
