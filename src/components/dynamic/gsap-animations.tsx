/**
 * Dynamic GSAP Animation Components
 * 
 * GSAP is a heavy animation library. These components are lazy-loaded
 * and only render when animations are needed.
 * 
 * Usage:
 *   import { FadeIn, SlideUp } from '@/components/dynamic/gsap-animations';
 */

'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';



interface AnimationProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

// Dynamic GSAP animation components
const FadeIn = dynamic(
  () => import('./gsap-internal').then((mod) => mod.FadeInInternal),
  { 
    loading: () => null,
    ssr: false // GSAP requires DOM
  }
);

const SlideUp = dynamic(
  () => import('./gsap-internal').then((mod) => mod.SlideUpInternal),
  { 
    loading: () => null,
    ssr: false 
  }
);

const StaggerContainer = dynamic(
  () => import('./gsap-internal').then((mod) => mod.StaggerContainerInternal),
  { 
    loading: () => null,
    ssr: false 
  }
);

export { FadeIn, SlideUp, StaggerContainer };
export type { AnimationProps };
