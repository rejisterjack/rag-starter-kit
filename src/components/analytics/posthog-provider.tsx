'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';
import { detectAIReferrer } from '@/lib/seo/ai-agents';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

    if (!key || typeof window === 'undefined') {
      return;
    }

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
    });

    // AIO measurement: attribute visits arriving from AI chat products
    // (chatgpt.com, perplexity.ai, gemini, copilot, claude.ai, ...)
    try {
      const aiSource = detectAIReferrer(document.referrer);
      if (aiSource) {
        posthog.capture('ai_referral_visit', {
          $set_once: { first_ai_referral: aiSource },
          ai_source: aiSource,
          referrer: document.referrer,
        });
      }
    } catch {
      // referrer parsing must never break analytics init
    }
  }, []);

  return <>{children}</>;
}

export { posthog };
