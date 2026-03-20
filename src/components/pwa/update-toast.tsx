'use client';

import { Download, RefreshCw, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { usePWA, useServiceWorker } from '@/hooks/use-pwa';
import { cn } from '@/lib/utils';

/**
 * Props for UpdateToast component
 */
interface UpdateToastProps {
  /** Custom className */
  className?: string;
  /** Auto-hide after update complete (ms) */
  autoHideDelay?: number;
  /** Show update check on mount */
  checkOnMount?: boolean;
}

/**
 * Update notification toast component
 * Shows when a new version of the app is available
 *
 * @example
 * ```tsx
 * // Basic usage
 * <UpdateToast />
 *
 * // With custom options
 * <UpdateToast checkOnMount={true} autoHideDelay={3000} />
 * ```
 */
export function UpdateToast({
  className,
  autoHideDelay = 0,
  checkOnMount = true,
}: UpdateToastProps) {
  const { updateAvailable, isUpdating, update, checkForUpdate } = useServiceWorker();
  const [showToast, setShowToast] = useState(false);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (checkOnMount) {
      void checkForUpdate();
    }
  }, [checkOnMount, checkForUpdate]);

  useEffect(() => {
    if (updateAvailable) {
      setShowToast(true);
    }
  }, [updateAvailable]);

  useEffect(() => {
    if (updateComplete && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        setIsClosing(true);
        setTimeout(() => setShowToast(false), 300);
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [updateComplete, autoHideDelay]);

  const handleUpdate = useCallback(async () => {
    setUpdateComplete(false);
    await update();
    setUpdateComplete(true);
  }, [update]);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowToast(false);
      setIsClosing(false);
    }, 300);
  };

  return (
    <ToastProvider>
      {showToast && (
        <div
          className={cn(
            'fixed z-[100] transition-all duration-300',
            isClosing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0',
            'bottom-0 right-0 p-4 md:max-w-[420px] w-full'
          )}
        >
          <Toast
            variant="default"
            className={cn(
              'border-primary/20 bg-background shadow-lg',
              updateComplete && 'border-green-500/20',
              className
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  updateComplete ? 'bg-green-100 dark:bg-green-900' : 'bg-primary/10'
                )}
              >
                {isUpdating ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                ) : updateComplete ? (
                  <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Download className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <ToastTitle className="text-sm font-semibold">
                  {isUpdating
                    ? 'Updating...'
                    : updateComplete
                      ? 'Update complete!'
                      : 'Update available'}
                </ToastTitle>
                <ToastDescription className="text-xs text-muted-foreground">
                  {isUpdating
                    ? 'Please wait while we update the app'
                    : updateComplete
                      ? 'The app has been updated to the latest version'
                      : 'A new version is available. Refresh to get the latest features.'}
                </ToastDescription>
              </div>
            </div>
            {!updateComplete && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="h-8"
                  disabled={isUpdating}
                  onClick={() => void handleUpdate()}
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Update now
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={isUpdating}
                  onClick={handleDismiss}
                >
                  Later
                </Button>
              </div>
            )}
            <ToastClose onClick={handleDismiss} />
          </Toast>
        </div>
      )}
      <ToastViewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </ToastProvider>
  );
}

/**
 * Update banner component
 * Fixed banner showing update availability
 */
export function UpdateBanner({ className }: { className?: string }) {
  const { updateAvailable, isUpdating, update } = useServiceWorker();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setIsVisible(true);
    }
  }, [updateAvailable]);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => setIsVisible(false), 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed left-0 right-0 top-0 z-50 border-b bg-primary px-4 py-2 text-primary-foreground shadow-lg',
        'transition-all duration-300',
        isClosing ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100',
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">A new version is available!</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            disabled={isUpdating}
            onClick={() => void update()}
          >
            {isUpdating ? (
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3 w-3" />
            )}
            {isUpdating ? 'Updating...' : 'Update now'}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 hover:bg-primary-foreground/10"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Version info component
 * Shows current app version and update status
 */
export function VersionInfo({ className }: { className?: string }) {
  const { isRegistered, updateAvailable } = useServiceWorker();
  const { isInstalled } = usePWA();

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <span>v{process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}</span>
      {isInstalled && (
        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-400">
          Installed
        </span>
      )}
      {isRegistered && (
        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-400">
          SW Active
        </span>
      )}
      {updateAvailable && (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-400">
          Update Available
        </span>
      )}
    </div>
  );
}

/**
 * Manual update checker button
 * Allows users to manually check for updates
 */
export function CheckUpdateButton({
  className,
  variant = 'outline',
  size = 'default',
}: {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  const { checkForUpdate, isUpdating } = useServiceWorker();
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const handleCheck = async () => {
    setIsChecking(true);
    await checkForUpdate();
    setLastChecked(new Date());
    setIsChecking(false);
  };

  const buttonContent = (
    <>
      <RefreshCw className={cn('h-4 w-4', (isChecking || isUpdating) && 'animate-spin')} />
      {size !== 'icon' && (
        <span>{isChecking || isUpdating ? 'Checking...' : 'Check for updates'}</span>
      )}
    </>
  );

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant={variant}
        size={size}
        disabled={isChecking || isUpdating}
        onClick={() => void handleCheck()}
        className={cn('gap-2', size === 'icon' && 'h-9 w-9')}
      >
        {buttonContent}
      </Button>
      {lastChecked && (
        <span className="text-xs text-muted-foreground">
          Last checked: {lastChecked.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
