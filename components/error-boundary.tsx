'use client';

import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { createLogger } from '@/lib/logger';

const log = createLogger('error-boundary');

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error('React error boundary caught an error', error, {
      action: 'component_error',
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;

      if (Fallback && this.state.error) {
        return <Fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return <DefaultErrorFallback error={this.state.error} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * Crash-safe localized copy for the default error fallback.
 *
 * The error boundary is a React class component and may catch errors that
 * originate *above* or *inside* the next-intl provider, so we cannot rely on
 * `useTranslations` (it would throw when the intl context is missing and break
 * the boundary itself). Instead we read the active language straight from the
 * `<html lang>` attribute and pick from this tiny inline map — no context, no
 * throw. Falls back to Hebrew (the app default) when `lang` is anything else.
 */
interface ErrorFallbackCopy {
  heading: string;
  body: string;
  retry: string;
  home: string;
}

const ERROR_FALLBACK_COPY: Record<'he' | 'en', ErrorFallbackCopy> = {
  he: {
    heading: 'שגיאה ברכיב',
    body: 'אירעה שגיאה בטעינת התוכן. אנא נסה שוב.',
    retry: 'נסה שוב',
    home: 'חזרה לדף הבית',
  },
  en: {
    heading: 'Component error',
    body: 'An error occurred while loading the content. Please try again.',
    retry: 'Try again',
    home: 'Back to home',
  },
};

function getErrorFallbackCopy(): ErrorFallbackCopy {
  const lang =
    typeof document !== 'undefined'
      ? document.documentElement.lang
      : 'he';
  return lang === 'en' ? ERROR_FALLBACK_COPY.en : ERROR_FALLBACK_COPY.he;
}

function DefaultErrorFallback({
  error,
  retry,
}: {
  error: Error | null;
  retry: () => void;
}) {
  const copy = getErrorFallbackCopy();
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 border border-destructive/20">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-foreground text-center mb-2">
          {copy.heading}
        </h3>
        <p className="text-muted-foreground text-center mb-4">
          {copy.body}
        </p>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded text-sm">
            <p className="text-destructive font-mono text-right" dir="ltr">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={retry}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            {copy.retry}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            {copy.home}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
