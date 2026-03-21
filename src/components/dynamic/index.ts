/**
 * Dynamic Components Index
 * 
 * Barrel file for all lazy-loaded components.
 * Import from here to ensure proper code splitting.
 * 
 * @example
 * ```tsx
 * import { DynamicLineChart, FadeIn, PDFViewer } from '@/components/dynamic';
 * ```
 */

// Chart components (lazy-loaded recharts)
export {
  DynamicLineChart,
  DynamicBarChart,
  DynamicPieChart,
  DynamicAreaChart,
  Line,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from './chart-components';

// D3 visualizations (lazy-loaded)
export { D3Chart } from './d3-visualization';
export type { D3ChartProps } from './d3-visualization';

// GSAP animations (lazy-loaded)
export { FadeIn, SlideUp, StaggerContainer } from './gsap-animations';
export type { AnimationProps } from './gsap-animations';

// PDF export (lazy-loaded)
export { PDFViewer, PDFDownloadLink } from './pdf-export';
export type { PDFViewerProps } from './pdf-export';
export {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
} from './pdf-export';
