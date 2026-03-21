'use client';

/**
 * React Error Boundary
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors to console, and displays a fallback UI.
 */

import { AlertCircle, Home, RefreshCcw } from 'lucide-react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  /** React children to render inside the error boundary */
  children: ReactNode;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Reset the error boundary when this value changes */
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Default fallback UI shown when an error occurs
 */
function DefaultFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border rounded-lg shadow-sm p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>

        <p className="text-muted-foreground mb-4">
          We apologize for the inconvenience. Please try again.
        </p>

        {process.env.NODE_ENV === 'development' && error && (
          <div className="bg-muted rounded p-3 mb-4 text-left overflow-auto">
            <p className="text-xs text-muted-foreground mb-1">Error Details:</p>
            <code className="text-xs font-mono text-destructive break-all">{error.message}</code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onReset} variant="default" className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </Button>

          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            Reload Page
          </Button>

          <Button onClick={() => (window.location.href = '/')} variant="ghost" className="gap-2">
            <Home className="w-4 h-4" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Error Boundary Component
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <Dashboard />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info
    this.setState({ errorInfo });

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );

      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

/**
 * Hook to get the error reset function
 * Must be used inside an ErrorBoundary
 */
export function useErrorBoundary() {
  const [key, setKey] = React.useState(0);

  const reset = React.useCallback(() => {
    setKey((prev) => prev + 1);
  }, []);

  return { reset, resetKey: key };
}

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps?: Omit<Props, 'children'>
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  const displayName = Component.displayName || Component.name || 'Component';
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`;

  return WrappedComponent;
}

export default ErrorBoundary;
