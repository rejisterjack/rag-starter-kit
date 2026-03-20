'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';

import { PostHogProvider } from './providers/posthog-provider';

/**
 * Props for the Providers component
 */
interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers component that wraps the application with all necessary context providers
 * Includes: React Query, Theme Provider, PostHog Analytics
 */
export function Providers({ children }: ProvidersProps): React.ReactElement {
  // Ensure QueryClient is only created once per component lifecycle
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for better UX
            refetchOnWindowFocus: false,
            // Retry failed requests 2 times
            retry: 2,
            // Stale time of 5 minutes
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
      >
        <PostHogProvider>{children}</PostHogProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
