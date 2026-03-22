/**
 * Performance Monitoring Utilities
 *
 * Tools for monitoring and optimizing application performance
 */

import { logger } from '@/lib/logger';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

const _THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  CLS: { good: 0.1, poor: 0.25 },
};

export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;

  observeWebVitals();
  observeLongTasks();
}

function observeWebVitals(): void {
  // Simplified Web Vitals observation
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.debug('Performance entry', { name: entry.name, duration: entry.duration });
        }
      });
      observer.observe({ entryTypes: ['measure', 'navigation'] });
    } catch {
      // Not supported
    }
  }
}

function observeLongTasks(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = (entry as PerformanceEntry & { duration: number }).duration;
        if (duration > 50) {
          logger.warn('Long task detected', { duration, name: entry.name });
        }
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch {
    // Not supported
  }
}

export function reportMetric(metric: PerformanceMetric): void {
  logger.debug('Performance metric', metric);
}

export function mark(name: string): void {
  if (typeof performance !== 'undefined') {
    performance.mark(name);
  }
}

export async function time<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    reportMetric({
      name,
      value: duration,
      rating: duration < 100 ? 'good' : duration < 500 ? 'needs-improvement' : 'poor',
    });
    return result;
  } catch (error) {
    logger.error('Function failed', { name, error });
    throw error;
  }
}
