# Analytics Components

A comprehensive set of analytics UI components for the RAG Starter Kit dashboard.

## Components

### MetricsCard
Displays a metric with title, value, trend indicator, and optional sparkline chart.

```tsx
import { MetricsCard, MetricsCardGroup } from "@/components/analytics/metrics-card";

<MetricsCard
  title="Total Queries"
  value={15420}
  trend={12.5}
  trendLabel="vs last period"
  icon={<MessageSquare className="h-4 w-4" />}
  sparklineData={[45, 52, 48, 60, 55, 65, 70]}
/>
```

### TimeSeriesChart
Line, area, or bar chart for time-series data visualization using Recharts.

```tsx
import { TimeSeriesChart } from "@/components/analytics/time-series-chart";

<TimeSeriesChart
  title="Query Volume"
  data={[
    { date: "2024-01-01", queries: 450, users: 120 },
    { date: "2024-01-02", queries: 520, users: 135 },
  ]}
  series={[
    { key: "queries", name: "Queries", color: "#3b82f6" },
    { key: "users", name: "Users", color: "#10b981" },
  ]}
  type="area"
/>
```

### DistributionChart
Pie or donut chart for displaying distribution data.

```tsx
import { DistributionChart } from "@/components/analytics/distribution-chart";

<DistributionChart
  title="Query Types"
  data={[
    { name: "General", value: 450, color: "#3b82f6" },
    { name: "Search", value: 320, color: "#10b981" },
  ]}
  type="donut"
/>
```

### TopList
Displays ranked lists with avatars, trends, and progress bars.

```tsx
import { TopList } from "@/components/analytics/top-list";

<TopList
  title="Top Users"
  items={[
    { id: "1", rank: 1, title: "Alice", value: 342, trend: 15.2 },
    { id: "2", rank: 2, title: "Bob", value: 289, trend: -5.3 },
  ]}
  type="user"
  showTrend
/>
```

### RealtimeMonitor
Live metrics display with auto-refresh and event feed.

```tsx
import { RealtimeMonitor } from "@/components/analytics/realtime-monitor";

<RealtimeMonitor
  title="Live System Monitor"
  metrics={[
    { id: "1", label: "Active Users", value: 42, icon: Users },
    { id: "2", label: "Queries/min", value: 15, icon: MessageSquare },
  ]}
  events={events}
  isConnected={true}
/>
```

### DateRangePicker
Date range selection with presets and calendar interface.

```tsx
import { DateRangePicker, useDateRange } from "@/components/analytics/date-range-picker";

const { range, preset, setRange } = useDateRange("last7days");

<DateRangePicker
  value={range}
  onChange={setRange}
/>
```

## Hooks

### useAnalytics
Main hook for fetching analytics data with React Query.

```tsx
import { useAnalytics, useRealtimeAnalytics } from "@/hooks/use-analytics";

const { overview, timeSeries, isLoading } = useAnalytics({
  filter: { startDate, endDate },
  refreshInterval: 60000,
});

const { metrics, events } = useRealtimeAnalytics({
  refreshInterval: 5000,
});
```

## Dependencies

- `recharts` - Charting library
- `date-fns` - Date manipulation
- `lucide-react` - Icons
- `@tanstack/react-query` - Data fetching

## Styling

All components follow the project's design system:
- Use Tailwind CSS for styling
- Support dark mode via CSS variables
- Use shadcn/ui components as base
- Responsive design patterns
