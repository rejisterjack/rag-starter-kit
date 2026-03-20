'use client';

import { Download, MoreVertical, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useInstallPrompt, usePWA } from '@/hooks/use-pwa';
import { cn } from '@/lib/utils';

/**
 * Install prompt variants
 */
type PromptVariant = 'banner' | 'card' | 'minimal';

/**
 * Props for InstallPrompt component
 */
interface InstallPromptProps {
  /** Visual variant of the prompt */
  variant?: PromptVariant;
  /** Custom className */
  className?: string;
  /** Position for banner variant */
  position?: 'top' | 'bottom';
  /** Delay before showing (ms) */
  delay?: number;
  /** Auto-hide after duration (ms), 0 for no auto-hide */
  autoHide?: number;
}

/**
 * Install prompt banner/card component
 * Shows when app is installable with platform-specific instructions
 *
 * @example
 * ```tsx
 * // Banner at bottom (default)
 * <InstallPrompt />
 *
 * // Card variant
 * <InstallPrompt variant="card" />
 *
 * // Top banner
 * <InstallPrompt position="top" />
 * ```
 */
export function InstallPrompt({
  variant = 'banner',
  className,
  position = 'bottom',
  delay = 2000,
  autoHide = 0,
}: InstallPromptProps) {
  const {
    isInstallable: isAvailable,
    promptInstall: showPrompt,
    dismissInstall: dismiss,
  } = useInstallPrompt();
  const { platform, isIOS } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isAvailable) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAvailable, delay]);

  const handleDismiss = useCallback(() => {
    setIsClosing(true);
    // Delay actual dismiss to allow animation
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      dismiss();
    }, 300);
  }, [dismiss]);

  useEffect(() => {
    if (autoHide > 0 && isVisible) {
      const timer = setTimeout(handleDismiss, autoHide);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoHide, isVisible, handleDismiss]);

  const handleInstall = useCallback(async () => {
    // iOS/Safari requires manual installation
    if (platform === 'ios' || isIOS) {
      setShowInstructions(true);
      return;
    }

    await showPrompt();
  }, [platform, isIOS, showPrompt]);

  const getInstallInstructions = (): string[] => {
    if (platform === 'ios') {
      return [
        'Tap the Share button in Safari (the square with an arrow)',
        'Scroll down and tap "Add to Home Screen"',
        'Tap "Add" in the top right corner',
      ];
    }
    if (platform === 'android') {
      return [
        'Tap the menu (three dots) in Chrome',
        'Tap "Add to Home screen" or "Install app"',
        'Tap "Install" to confirm',
      ];
    }
    return [
      'Click the install icon in the address bar',
      'Or click the menu (three dots) and select "Install"',
      'Click "Install" to confirm',
    ];
  };

  if (!isAvailable && !showInstructions) return null;

  // iOS Instructions Modal
  if (showInstructions) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
        onClick={() => setShowInstructions(false)}
      >
        <div className="animate-slide-up" onClick={(e) => e.stopPropagation()}>
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Install on iOS
              </CardTitle>
              <CardDescription>
                Follow these steps to install the app on your device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {getInstallInstructions().map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowInstructions(false)}
              >
                Got it
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Banner Variant
  if (variant === 'banner') {
    if (!isVisible) return null;

    return (
      <div
        className={cn(
          'fixed left-0 right-0 z-50 border-b bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60',
          'transition-all duration-300 ease-out',
          position === 'top' ? 'top-0 border-t-0' : 'bottom-0 border-t',
          isClosing
            ? position === 'top'
              ? '-translate-y-full opacity-0'
              : 'translate-y-full opacity-0'
            : 'translate-y-0 opacity-100',
          className
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">Install RAG Chatbot</p>
              <p className="text-sm text-muted-foreground">
                Add to your home screen for quick access
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={handleInstall}>
              Install
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Card Variant
  if (variant === 'card') {
    if (!isVisible) return null;

    return (
      <div
        className={cn(
          'w-full max-w-sm transition-all duration-300',
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
          className
        )}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Install App</CardTitle>
                  <CardDescription className="text-xs">
                    Faster access, offline support
                  </CardDescription>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 -mr-2 -mt-2"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardFooter className="pt-0">
            <Button className="w-full" onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" />
              Install Now
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Minimal Variant
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-lg',
        'transition-all duration-300',
        isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
        className
      )}
    >
      <Download className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">Install app?</span>
      <Button size="sm" className="h-7 px-3 text-xs" onClick={handleInstall}>
        Install
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDismiss}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/**
 * Floating install button for mobile
 * Shows a fixed button that expands to show install options
 */
export function FloatingInstallButton({ className }: { className?: string }) {
  const {
    isInstallable: isAvailable,
    promptInstall: showPrompt,
    dismissInstall: dismiss,
  } = useInstallPrompt();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isAvailable) return null;

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      {isExpanded ? (
        <div className="flex flex-col gap-2 rounded-2xl border bg-background p-2 shadow-xl animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              showPrompt();
              setIsExpanded(false);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Install App
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground"
            onClick={() => {
              dismiss();
              setIsExpanded(false);
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Don&apos;t show again
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg animate-fade-in"
          onClick={() => setIsExpanded(true)}
        >
          <Download className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}

/**
 * iOS-specific install hint
 * Shows a popup with iOS install instructions
 */
export function IOSInstallHint({ className }: { className?: string }) {
  const { platform, isIOS } = usePWA();
  const { isInstallable: isAvailable } = useInstallPrompt();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Show for iOS Safari users who haven't installed
    if ((platform === 'ios' || isIOS) && isAvailable) {
      const hasSeenHint = localStorage.getItem('pwa:ios-hint-seen');
      if (!hasSeenHint) {
        const timer = setTimeout(() => setIsVisible(true), 3000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [platform, isIOS, isAvailable]);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      localStorage.setItem('pwa:ios-hint-seen', 'true');
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 rounded-2xl border bg-background p-4 shadow-xl',
        'transition-all duration-300',
        isClosing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0',
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Share2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Install on your iPhone</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap <Share2 className="mx-1 inline h-4 w-4" />
            then &quot;Add to Home Screen&quot;
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <MoreVertical className="h-4 w-4" />
        <span>Add to Home Screen</span>
      </div>
    </div>
  );
}
