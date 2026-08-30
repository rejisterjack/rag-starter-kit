'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * NavigationProgress — CSS-based route transition indicator (no framer-motion).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'completing'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void pathname;
    void searchParams;
    setState('loading');

    timerRef.current = setTimeout(() => {
      setState('completing');
    }, 300);

    const idleTimer = setTimeout(() => {
      setState('idle');
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(idleTimer);
    };
  }, [pathname, searchParams]);

  if (state === 'idle') return null;

  const width = state === 'loading' ? '70%' : '100%';
  const glowLeft = state === 'loading' ? '65%' : '95%';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] opacity-100 transition-opacity duration-150"
      aria-hidden
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-purple-500 to-primary transition-[width] duration-300 ease-out"
        style={{ width }}
      />
      <div
        className="absolute top-0 h-full w-20 blur-sm bg-primary/60 transition-[left] duration-300 ease-out"
        style={{ left: glowLeft }}
      />
    </div>
  );
}
