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
  [key: string]: string | number | boolean | undefined | null;
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

function sendToErrorService(errorLog: ErrorLog): void {
  // TODO: Implement with actual error reporting service
  console.error('Error logged:', errorLog);
}
