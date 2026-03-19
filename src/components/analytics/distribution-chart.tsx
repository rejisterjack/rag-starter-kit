"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export interface DistributionData {
  name: string;
  value: number;
  color?: string;
}

export interface DistributionChartProps {
  data: DistributionData[];
  title?: string;
  description?: string;
  type?: "pie" | "donut";
  showLegend?: boolean;
  showLabels?: boolean;
  height?: number;
  loading?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
  innerRadius?: number;
  outerRadius?: number;
}

const defaultColors = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted))",
  "hsl(var(--destructive))",
  "hsl(200, 80%, 50%)",
  "hsl(280, 80%, 50%)",
  "hsl(30, 80%, 50%)",
];

function ChartTooltip({
  active,
  payload,
  total,
  valueFormatter = (v) => v.toString(),
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DistributionData }>;
  total: number;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : "0";

  return (
    <div className="rounded-lg border bg-popover p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: data.payload.color }}
        />
        <span className="text-sm font-medium">{data.name}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        {valueFormatter(data.value)} ({percentage}%)
      </div>
    </div>
  );
}

function CustomLegend({
  payload,
  total,
  valueFormatter,
}: {
  payload?: Array<{ value: string; color: string; payload: DistributionData }>;
  total: number;
  valueFormatter: (value: number) => string;
}) {
  if (!payload) return null;

  return (
    <ul className="space-y-2 mt-4">
      {payload.map((entry, index) => {
        const percentage = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : "0";
        return (
          <li key={`legend-${index}`} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.value}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{valueFormatter(entry.payload.value)}</span>
              <span className="text-xs text-muted-foreground">({percentage}%)</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DistributionChart({
  data,
  title,
  description,
  type = "donut",
  showLegend = true,

  height = 300,
  loading = false,
  valueFormatter = (v) => v.toLocaleString(),
  className,
  innerRadius,
  outerRadius,
}: DistributionChartProps) {
  const chartData = React.useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || defaultColors[index % defaultColors.length],
    }));
  }, [data]);

  const total = React.useMemo(
    () => chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  );

  const calculatedInnerRadius = innerRadius ?? (type === "donut" ? 60 : 0);
  const calculatedOuterRadius = outerRadius ?? (type === "donut" ? 100 : 120);

  if (loading) {
    return (
      <Card className={className}>
        {(title || description) && (
          <CardHeader>
            {title && <div className="h-5 w-40 bg-muted animate-pulse rounded" />}
            {description && (
              <div className="h-4 w-60 bg-muted animate-pulse rounded mt-2" />
            )}
          </CardHeader>
        )}
        <CardContent>
          <div className="w-full bg-muted animate-pulse rounded" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height }}
          >
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={calculatedInnerRadius}
                  outerRadius={calculatedOuterRadius}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  content={<ChartTooltip total={total} valueFormatter={valueFormatter} />}
                />
              </PieChart>
            </ResponsiveContainer>
            {type === "donut" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-bold">{valueFormatter(total)}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
            )}
          </div>
          {showLegend && (
            <div className="w-full sm:w-48">
              <CustomLegend
                payload={chartData.map((item) => ({
                  value: item.name,
                  color: item.color!,
                  payload: item,
                }))}
                total={total}
                valueFormatter={valueFormatter}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DistributionChart;
