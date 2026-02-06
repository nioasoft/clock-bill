/**
 * Logger utility for consistent logging across the application
 * Provides different log levels and structured logging output
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enableTimestamp: boolean;
  enableColors: boolean;
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
};

/**
 * Get the current log level from environment
 * Defaults to INFO in production, DEBUG in development
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();

  if (envLevel === 'DEBUG') return LogLevel.DEBUG;
  if (envLevel === 'INFO') return LogLevel.INFO;
  if (envLevel === 'WARN') return LogLevel.WARN;
  if (envLevel === 'ERROR') return LogLevel.ERROR;
  if (envLevel === 'NONE') return LogLevel.NONE;

  // Default: DEBUG in development, INFO in production
  return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
}

/**
 * Format timestamp for log messages
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Colorize a message (if colors are enabled)
 */
function colorize(message: string, color: string, enabled: boolean): string {
  if (!enabled) return message;
  return `${color}${message}${colors.reset}`;
}

/**
 * Logger class
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: getLogLevel(),
      enableTimestamp: true,
      enableColors: process.env.NODE_ENV !== 'production',
      ...config,
    };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * Format a log message
   */
  private formatMessage(
    level: string,
    message: string,
    meta?: Record<string, unknown>
  ): string {
    const parts: string[] = [];

    // Add timestamp
    if (this.config.enableTimestamp) {
      parts.push(colorize(`[${formatTimestamp()}]`, colors.dim, this.config.enableColors));
    }

    // Add log level
    parts.push(colorize(`[${level}]`, this.getLevelColor(level), this.config.enableColors));

    // Add prefix if configured
    if (this.config.prefix) {
      parts.push(colorize(`[${this.config.prefix}]`, colors.magenta, this.config.enableColors));
    }

    // Add message
    parts.push(message);

    // Add metadata if provided
    if (meta && Object.keys(meta).length > 0) {
      try {
        const metaStr = JSON.stringify(meta, null, 2);
        parts.push('\n' + colorize(metaStr, colors.dim, this.config.enableColors));
      } catch {
        parts.push('\n' + colorize('[Unable to stringify metadata]', colors.dim, this.config.enableColors));
      }
    }

    return parts.join(' ');
  }

  /**
   * Get color for log level
   */
  private getLevelColor(level: string): string {
    switch (level) {
      case 'DEBUG':
        return colors.dim;
      case 'INFO':
        return colors.green;
      case 'WARN':
        return colors.yellow;
      case 'ERROR':
        return colors.red;
      default:
        return colors.reset;
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, meta));
    }
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMeta = {
        ...meta,
        ...(error instanceof Error
          ? {
              error: error.message,
              stack: error.stack,
              name: error.name,
            }
          : { error }),
      };
      console.error(this.formatMessage('ERROR', message, errorMeta));
    }
  }

  /**
   * Create a child logger with a different prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with a custom prefix
 */
export function createLogger(prefix: string): Logger {
  return logger.child(prefix);
}
