/**
 * React Error Boundary
 *
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the app.
 */

'use client';

import { AlertCircle, Bug, Home, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Component name for logging */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

// ============================================================================
// Error ID Generator
// ============================================================================

function generateErrorId(): string {
  return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, componentName } = this.props;
    const { errorId } = this.state;

    // Log the error
    logger.error('React Error Boundary caught an error', {
      errorId,
      component: componentName || 'Unknown',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Call optional onError callback
    onError?.(error, errorInfo);

    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    const { hasError, error, errorId } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Default error UI
    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Something went wrong</CardTitle>
            <CardDescription>
              We apologize for the inconvenience. An unexpected error has occurred.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Details (collapsed by default in production) */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Bug className="h-4 w-4" />
                  <span>Error Details (Development Only)</span>
                </div>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-40 p-2 bg-background rounded">
                  {error.message}
                  {'\n'}
                  {error.stack}
                </pre>
              </div>
            )}

            {/* Error ID for support */}
            {errorId && (
              <p className="text-xs text-muted-foreground text-center">
                Error ID: <code className="bg-muted px-1 py-0.5 rounded">{errorId}</code>
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button onClick={this.handleReset} className="flex-1" variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={this.handleReload} className="flex-1" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>
              <Button onClick={this.handleGoHome} className="flex-1" variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

// ============================================================================
// API Error Boundary (for API route errors)
// ============================================================================

interface APIErrorBoundaryProps {
  children: ReactNode;
  onAPIError?: (error: unknown) => void;
}

interface APIErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class APIErrorBoundary extends Component<APIErrorBoundaryProps, APIErrorBoundaryState> {
  constructor(props: APIErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): Partial<APIErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown): void {
    const { onAPIError } = this.props;

    logger.error('API Error Boundary caught an error', { error });
    onAPIError?.(error);
  }

  render(): ReactNode {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="p-4 text-center">
          <p className="text-destructive">Unable to load data. Please try again.</p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            variant="outline"
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// Hook for functional components
// ============================================================================

import { useCallback, useState } from 'react';

interface UseErrorHandlerReturn {
  error: Error | null;
  errorInfo: string;
  handleError: (error: Error) => void;
  clearError: () => void;
}

export function useErrorHandler(componentName?: string): UseErrorHandlerReturn {
  const [error, setError] = useState<Error | null>(null);
  const [errorInfo, setErrorInfo] = useState<string>('');

  const handleError = useCallback(
    (err: Error) => {
      const errorId = generateErrorId();

      logger.error('Error caught by useErrorHandler', {
        errorId,
        component: componentName || 'Unknown',
        error: err.message,
        stack: err.stack,
      });

      setError(err);
      setErrorInfo(errorId);
    },
    [componentName]
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorInfo('');
  }, []);

  return {
    error,
    errorInfo,
    handleError,
    clearError,
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { ERROR_CODES, getErrorCategory, isRetryableError } from './error-codes';
export { createErrorResponse, getErrorMessage, getErrorStatusCode } from './error-messages';
