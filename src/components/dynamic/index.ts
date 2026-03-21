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
  Area,
  Bar,
  CartesianGrid,
  Cell,
  DynamicAreaChart,
  DynamicBarChart,
  DynamicLineChart,
  DynamicPieChart,
  Legend,
  Line,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from './chart-components';
export type { D3ChartProps } from './d3-visualization';
// D3 visualizations (lazy-loaded)
export { D3Chart } from './d3-visualization';
export type { AnimationProps } from './gsap-animations';
// GSAP animations (lazy-loaded)
export { FadeIn, SlideUp, StaggerContainer } from './gsap-animations';
export type { PDFViewerProps } from './pdf-export';
// PDF export (lazy-loaded)
export {
  Document,
  Image,
  Link,
  Page,
  PDFDownloadLink,
  PDFViewer,
  StyleSheet,
  Text,
  View,
} from './pdf-export';
