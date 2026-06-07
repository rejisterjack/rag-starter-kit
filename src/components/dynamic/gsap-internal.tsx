/**
 * Internal Animation Components
 *
 * Framer-motion implementations that are lazy-loaded.
 * Do not import directly - use the dynamic exports instead.
 */

'use client';

import { m } from 'framer-motion';
import type { ReactNode } from 'react';

interface AnimationProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeInInternal({ children, delay = 0, duration = 0.5, className }: AnimationProps) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
}

export function SlideUpInternal({
  children,
  delay = 0,
  duration = 0.5,
  className,
}: AnimationProps) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
}

interface StaggerProps extends AnimationProps {
  staggerDelay?: number;
}

export function StaggerContainerInternal({
  children,
  delay = 0,
  staggerDelay = 0.1,
  className,
}: StaggerProps) {
  return (
    <m.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: staggerDelay, delayChildren: delay },
        },
      }}
    >
      {children}
    </m.div>
  );
}
