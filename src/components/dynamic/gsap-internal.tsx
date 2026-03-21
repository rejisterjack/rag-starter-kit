/**
 * Internal GSAP Animation Components
 * 
 * Actual GSAP implementations that are lazy-loaded.
 * Do not import directly - use the dynamic exports instead.
 */

'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface AnimationProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeInInternal({ 
  children, 
  delay = 0, 
  duration = 0.5,
  className 
}: AnimationProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    
    import('gsap').then((gsapModule) => {
      const gsapInstance = gsapModule.gsap;
      
      if (ref.current) {
        ctx = gsapInstance.context(() => {
          gsapInstance.fromTo(
            ref.current,
            { opacity: 0 },
            { opacity: 1, duration, delay, ease: 'power2.out' }
          );
        });
      }
    });

    return () => ctx?.revert();
  }, [delay, duration]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

export function SlideUpInternal({ 
  children, 
  delay = 0, 
  duration = 0.5,
  className 
}: AnimationProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    
    import('gsap').then((gsapModule) => {
      const gsap = gsapModule.gsap;
      
      if (ref.current) {
        ctx = gsap.context(() => {
          gsap.fromTo(
            ref.current,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration, delay, ease: 'power2.out' }
          );
        });
      }
    });

    return () => ctx?.revert();
  }, [delay, duration]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

interface StaggerProps extends AnimationProps {
  staggerDelay?: number;
}

export function StaggerContainerInternal({ 
  children, 
  delay = 0,
  staggerDelay = 0.1,
  className 
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    
    import('gsap').then((gsapModule) => {
      const gsap = gsapModule.gsap;
      
      if (ref.current) {
        const children = ref.current.children;
        ctx = gsap.context(() => {
          gsap.fromTo(
            children,
            { opacity: 0, y: 20 },
            { 
              opacity: 1, 
              y: 0, 
              duration: 0.4, 
              delay,
              stagger: staggerDelay,
              ease: 'power2.out' 
            }
          );
        });
      }
    });

    return () => ctx?.revert();
  }, [delay, staggerDelay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
