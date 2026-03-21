/**
 * Dynamic Chart Components
 *
 * These components are lazy-loaded to reduce initial bundle size.
 * Charts are typically only needed on analytics/dashboard pages.
 *
 * Usage:
 *   import { DynamicLineChart } from '@/components/dynamic/chart-components';
 */

'use client';

import dynamic from 'next/dynamic';

// Loading fallback for charts
const ChartSkeleton = () => (
  <div className="w-full h-[300px] bg-muted/50 animate-pulse rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground text-sm">Loading chart...</span>
  </div>
);

// Dynamically import recharts components
export const DynamicLineChart = dynamic(() => import('recharts').then((mod) => mod.LineChart), {
  loading: ChartSkeleton,
  ssr: false, // Charts use DOM APIs, disable SSR
});

export const DynamicBarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), {
  loading: ChartSkeleton,
  ssr: false,
});

export const DynamicPieChart = dynamic(() => import('recharts').then((mod) => mod.PieChart), {
  loading: ChartSkeleton,
  ssr: false,
});

export const DynamicAreaChart = dynamic(() => import('recharts').then((mod) => mod.AreaChart), {
  loading: ChartSkeleton,
  ssr: false,
});

// Re-export static components (lightweight)
export {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
