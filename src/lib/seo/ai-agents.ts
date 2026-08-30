/**
 * AI agent detection — used for AIO measurement (PostHog) and crawler logging.
 *
 * Two surfaces:
 *  - Crawler user-agents hitting the server (proxy.ts / route handlers)
 *  - Referrer domains from AI chat products (posthog-provider.tsx)
 */

/** Substring user-agent markers for AI crawlers and agents. */
export const AI_CRAWLER_UA_MARKERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'cohere-ai',
  'Meta-ExternalAgent',
  'Amazonbot',
  'aihitbot',
  'Diffbot',
] as const;

/** Referrer hosts of AI products whose users may click citations. */
export const AI_REFERRER_HOSTS: Record<string, string> = {
  'chatgpt.com': 'chatgpt',
  'chat.openai.com': 'chatgpt',
  'perplexity.ai': 'perplexity',
  'pplx.ai': 'perplexity',
  'gemini.google.com': 'gemini',
  'copilot.microsoft.com': 'copilot',
  'bing.com': 'bing_ai_overviews',
  'claude.ai': 'claude',
  'you.com': 'you',
  'duckduckgo.com': 'duckduckgo_ai',
  'phind.com': 'phind',
  'kagi.com': 'kagi',
  'grok.com': 'grok',
  'x.com': 'grok',
};

export interface AIDetection {
  isCrawler: boolean;
  crawlerName: string | null;
}

export function detectAICrawler(userAgent: string | null): AIDetection {
  if (!userAgent) return { isCrawler: false, crawlerName: null };
  const match = AI_CRAWLER_UA_MARKERS.find((marker) => userAgent.includes(marker));
  return match ? { isCrawler: true, crawlerName: match } : { isCrawler: false, crawlerName: null };
}

/** Map a document.referrer to an AI product name, or null. */
export function detectAIReferrer(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    return AI_REFERRER_HOSTS[host] ?? null;
  } catch {
    return null;
  }
}
