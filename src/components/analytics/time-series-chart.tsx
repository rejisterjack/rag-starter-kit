'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type ChartType = 'line' | 'area' | 'bar';

export interface TimeSeriesData {
  date: string;
  [key: string]: number | string | undefined;
}

export interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  type?: 'line' | 'area' | 'bar';
}

export interface TimeSeriesChartProps {
  data: Array<Record<string, string | number>>;
  series: SeriesConfig[];
  title?: string;
  description?: string;
  type?: ChartType;
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  loading?: boolean;
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
  className?: string;
  stacked?: boolean;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => v.toString(),
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  valueFormatter?: (value: number) => string;
  series: SeriesConfig[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border bg-popover p-3 shadow-sm">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const seriesConfig = series.find((s) => s.key === entry.dataKey);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{seriesConfig?.name || entry.dataKey}:</span>
              <span className="font-medium">{valueFormatter(entry.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimeSeriesChart({
  data,
  series,
  title,
  description,
  type = 'area',
  showLegend = true,
  showGrid = true,
  height = 300,
  loading = false,
  valueFormatter = (v) => v.toLocaleString(),
  dateFormatter = (d) => d,
  className,
  stacked = false,
}: TimeSeriesChartProps) {
  if (loading) {
    return (
      <Card className={className}>
        {(title || description) && (
          <CardHeader>
            {title && <div className="h-5 w-40 bg-muted animate-pulse rounded" />}
            {description && <div className="h-4 w-60 bg-muted animate-pulse rounded mt-2" />}
          </CardHeader>
        )}
        <CardContent>
          <div className="w-full bg-muted animate-pulse rounded" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 10, left: 0, bottom: 0 },
    };

    const commonAxisProps = {
      xAxis: (
        <XAxis
          dataKey="date"
          tickFormatter={dateFormatter}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
      ),
      yAxis: (
        <YAxis
          tickFormatter={valueFormatter}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          dx={-10}
        />
      ),
      grid: showGrid && (
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
      ),
      tooltip: (
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} series={series} />} />
      ),
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            {showLegend && <Legend />}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                stackId={stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            {showLegend && <Legend />}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        );
      default:
        return (
          <AreaChart {...commonProps}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            {showLegend && <Legend />}
            {series.map((s, _index) => (
              <defs key={s.key}>
                <linearGradient id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              </defs>
            ))}
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                fill={`url(#gradient-${s.key})`}
                strokeWidth={2}
                stackId={stacked ? 'stack' : undefined}
              />
            ))}
          </AreaChart>
        );
    }
  };

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default TimeSeriesChart;
