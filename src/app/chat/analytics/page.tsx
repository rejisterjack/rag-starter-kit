import { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/analytics';

export const metadata: Metadata = {
  title: 'Analytics | RAG Starter Kit',
  description: 'Monitor your RAG chatbot performance and usage',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
