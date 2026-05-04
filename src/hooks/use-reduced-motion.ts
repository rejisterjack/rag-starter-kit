'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect if the user prefers reduced motion.
 *
 * Used to disable Framer Motion animations when the user has
 * enabled "Reduce motion" in their OS accessibility settings.
 *
 * @example
 * ```tsx
 * import { useReducedMotion } from '@/hooks/use-reduced-motion';
 *
 * function AnimatedComponent() {
 *   const prefersReducedMotion = useReducedMotion();
 *
 *   return (
 *     <motion.div
 *       animate={{ opacity: 1, y: 0 }}
 *       transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
 *     />
 *   );
 * }
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}
