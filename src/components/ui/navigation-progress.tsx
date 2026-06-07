'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * NavigationProgress — thin animated progress bar at the top of the viewport
 * that appears during route changes. Uses framer-motion for smooth animation.
 *
 * How it works:
 * - Detects pathname/searchParams changes (route transitions)
 * - Shows a progress bar that quickly animates to ~70%, then completes on mount
 * - Uses a two-phase animation: "loading" (fast to 70%) → "completing" (to 100%) → exit
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'completing'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // On route change start: begin the loading animation
    // pathname and searchParams trigger this effect on route changes
    void pathname;
    void searchParams;
    setState('loading');

    // After a short delay, mark as completing (simulates the finish)
    timerRef.current = setTimeout(() => {
      setState('completing');
    }, 300);

    // After the complete animation finishes, go idle
    const idleTimer = setTimeout(() => {
      setState('idle');
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(idleTimer);
    };
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {state !== 'idle' && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[9999] h-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-purple-500 to-primary"
            initial={{ width: '0%' }}
            animate={{
              width: state === 'loading' ? '70%' : '100%',
            }}
            transition={{
              duration: state === 'loading' ? 0.4 : 0.2,
              ease: state === 'loading' ? 'easeOut' : 'easeIn',
            }}
          />
          {/* Glow effect */}
          <motion.div
            className="absolute top-0 h-full w-20 blur-sm bg-primary/60"
            initial={{ left: '0%' }}
            animate={{
              left: state === 'loading' ? '65%' : '95%',
            }}
            transition={{
              duration: state === 'loading' ? 0.4 : 0.2,
              ease: state === 'loading' ? 'easeOut' : 'easeIn',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
