'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { domAnimation, LazyMotion } from 'framer-motion';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { PWAProvider } from '@/components/pwa';
import { PlausibleProvider } from './providers/plausible-provider';

/**
 * Props for the Providers component
 */
interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers component that wraps the application with all necessary context providers
 * Includes: React Query, Theme Provider, PWA/Offline Provider, Plausible Analytics
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
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={true}
          disableTransitionOnChange={false}
        >
          <PWAProvider
            showInstallPrompt={true}
            showUpdateToast={true}
            showConnectivityBanner={true}
            showSyncToast={true}
            connectivityPosition="top"
            installPromptDelay={10000}
          >
            <LazyMotion features={domAnimation} strict>
              <PlausibleProvider>{children}</PlausibleProvider>
            </LazyMotion>
          </PWAProvider>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
