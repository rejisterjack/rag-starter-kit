"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Home, MessageSquare } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OfflineIndicator, NetworkStatusBadge } from "@/components/pwa";
import { useOfflineStatus } from "@/hooks/use-pwa";

/**
 * Offline fallback page
 * Displayed when the app is offline and content cannot be loaded from cache
 * 
 * @route /offline
 */
export default function OfflinePage() {
  const { isOffline, formattedOfflineDuration } = useOfflineStatus();
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastRetry, setLastRetry] = useState<Date | null>(null);

  const handleRetry = () => {
    setIsRetrying(true);
    setLastRetry(new Date());
    
    // Try to reload the page
    window.location.reload();
  };

  // Auto-retry when coming back online
  useEffect(() => {
    if (!isOffline) {
      const timer = setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOffline]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      {/* Offline indicator */}
      <OfflineIndicator variant="banner" position="top" />

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <WifiOff className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">You&apos;re offline</CardTitle>
          <CardDescription>
            {isOffline ? (
              <>
                Unable to connect to the internet
                {formattedOfflineDuration && (
                  <span className="block mt-1">
                    Offline for {formattedOfflineDuration}
                  </span>
                )}
              </>
            ) : (
              "Connection restored! Taking you back..."
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Network status */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">Network status</span>
            <NetworkStatusBadge />
          </div>

          {/* What you can do offline */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">While you&apos;re offline:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Previously loaded messages are available</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Type messages - they&apos;ll send when you reconnect</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Your settings and preferences are saved</span>
              </li>
            </ul>
          </div>

          {/* Last retry info */}
          {lastRetry && (
            <p className="text-center text-xs text-muted-foreground">
              Last retry: {lastRetry.toLocaleTimeString()}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Button
            className="w-full gap-2"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            <RefreshCw className={isRetrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isRetrying ? "Retrying..." : "Try again"}
          </Button>

          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1 gap-2" asChild>
              <Link href="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button variant="outline" className="flex-1 gap-2" asChild>
              <Link href="/chat">
                <MessageSquare className="h-4 w-4" />
                Chat
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Helpful tips */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Need help?{" "}
          <Link href="/help" className="text-primary hover:underline">
            Visit our help center
          </Link>
        </p>
      </div>
    </div>
  );
}
