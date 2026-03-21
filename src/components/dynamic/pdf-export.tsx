/**
 * Dynamic PDF Export Components
 *
 * @react-pdf/renderer is a heavy library (~500KB+).
 * These components are lazy-loaded and only downloaded
 * when PDF generation is needed.
 *
 * Usage:
 *   import { PDFViewer, PDFDownloadLink } from '@/components/dynamic/pdf-export';
 *
 *   <PDFViewer>
 *     <MyDocument />
 *   </PDFViewer>
 */

'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

// Loading fallback
const PDFSkeleton = () => (
  <div className="w-full h-[600px] bg-muted/50 animate-pulse rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground text-sm">Loading PDF viewer...</span>
  </div>
);

// PDFViewer props - matches @react-pdf/renderer
export interface PDFViewerProps {
  children: ReactNode;
  className?: string;
  showToolbar?: boolean;
  style?: React.CSSProperties;
}

// Dynamic PDF Viewer component
export const PDFViewer = dynamic<PDFViewerProps>(
  () =>
    import('@react-pdf/renderer').then((mod) => mod.PDFViewer) as Promise<
      React.ComponentType<PDFViewerProps>
    >,
  {
    loading: PDFSkeleton,
    ssr: false,
  }
);

// Dynamic PDF Download Link component - using lazy loading
export const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

// Re-export PDF components for document creation (lightweight)
export {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
