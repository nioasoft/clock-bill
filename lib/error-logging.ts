/**
 * Error Logging Utility
 *
 * Centralized error logging that can be extended with error reporting services
 * like Sentry, LogRocket, Bugsnag, etc.
 */

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  action?: string;
  route?: string;
  method?: string;
  [key: string]: any;
}

export interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  name?: string;
  digest?: string;
  context?: ErrorContext;
  level: 'error' | 'warning' | 'info';
}

export function logError(
  error: Error | string,
  context?: ErrorContext,
  level: 'error' | 'warning' | 'info' = 'error'
): void {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error !== 'string' ? error.stack : undefined,
    name: typeof error !== 'string' ? error.name : undefined,
    context,
    level,
  };

  if (process.env.NODE_ENV === 'development') {
    const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    logMethod('Error Log:', errorLog);
  }

  if (process.env.NODE_ENV === 'production') {
    sendToErrorService(errorLog);
  }
}

export function logReactError(error: Error, errorInfo: React.ErrorInfo, context?: ErrorContext): void {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    name: error.name,
    context: {
      ...context,
      componentStack: errorInfo.componentStack,
    },
    level: 'error',
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('React Error Boundary:', errorLog);
  }

  if (process.env.NODE_ENV === 'production') {
    sendToErrorService(errorLog);
  }
}

export function logApiError(
  error: Error | string,
  endpoint: string,
  method: string,
  context?: ErrorContext
): void {
  logError(error, {
    ...context,
    action: 'api_request',
    route: endpoint,
    method,
  });
}

export function logDatabaseError(
  error: Error | string,
  query: string,
  context?: ErrorContext
): void {
  logError(error, {
    ...context,
    action: 'database_query',
    query: query.substring(0, 100),
  });
}

function sendToErrorService(errorLog: ErrorLog): void {
  // TODO: Implement with actual error reporting service
  // Examples:
  // - Sentry: Sentry.captureException(error)
  // - LogRocket: logRocket.captureException(error)
  // - Bugsnag: Bugsnag.notify(error)

  // For now, just log to console
  console.error('Error logged:', errorLog);
}

export function useErrorReporter(context?: ErrorContext) {
  return {
    reportError: (error: Error | string, additionalContext?: ErrorContext) => {
      logError(error, { ...context, ...additionalContext });
    },
    reportWarning: (error: Error | string, additionalContext?: ErrorContext) => {
      logError(error, { ...context, ...additionalContext }, 'warning');
    },
    reportInfo: (message: string, additionalContext?: ErrorContext) => {
      logError(message, { ...context, ...additionalContext }, 'info');
    },
  };
}

export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error as Error, context);
      throw error;
    }
  }) as T;
}
