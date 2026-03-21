/**
 * Dynamic D3 Visualization Components
 * 
 * D3 is a heavy library (~300KB). These components are only loaded
 * when needed for complex custom visualizations.
 * 
 * Usage:
 *   import { DynamicD3Chart } from '@/components/dynamic/d3-visualization';
 */

'use client';

import dynamic from 'next/dynamic';


// Loading fallback
const D3Skeleton = () => (
  <div className="w-full h-[400px] bg-muted/50 animate-pulse rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground text-sm">Loading visualization...</span>
  </div>
);

interface D3ChartProps {
  data: unknown[];
  width?: number;
  height?: number;
  className?: string;
}

// Dynamic D3 chart component
const D3Chart = dynamic(
  () => import('./d3-chart-internal').then((mod) => mod.D3ChartInternal),
  { 
    loading: D3Skeleton,
    ssr: false // D3 requires DOM
  }
);

export { D3Chart };
export type { D3ChartProps };
