'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface IntersectionOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
}

interface IntersectionReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  isInView: boolean;
  hasAnimated: boolean;
}

export function useIntersectionObserver({
  threshold = 0.2,
  rootMargin = '0px 0px -50px 0px',
  triggerOnce = true,
}: IntersectionOptions = {}): IntersectionReturn {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      if (entry.isIntersecting) {
        setIsInView(true);
        if (triggerOnce) {
          setHasAnimated(true);
        }
      } else if (!triggerOnce) {
        setIsInView(false);
      }
    },
    [triggerOnce]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, handleIntersection]);

  return { ref, isInView: triggerOnce ? hasAnimated || isInView : isInView, hasAnimated };
}
