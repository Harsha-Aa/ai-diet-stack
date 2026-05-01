/**
 * Structured Logger Utility for AI Diet Meal Recommendation System
 * 
 * Provides JSON-formatted logging for CloudWatch with proper log levels,
 * context, and metadata for debugging and monitoring.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  functionName?: string;
  environment?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Structured Logger Class
 */
export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext = {}, minLevel: LogLevel = LogLevel.INFO) {
    this.context = {
      environment: process.env.NODE_ENV || 'development',
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      ...context,
    };
    this.minLevel = minLevel;
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Add context to all subsequent logs
   */
  addContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...context }, this.minLevel);
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /**
   * Format and output log entry
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...(metadata && { metadata }),
    };

    // Add error details if present
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(('code' in error) && { code: (error as any).code }),
        ...(('statusCode' in error) && { statusCode: (error as any).statusCode }),
      };
    }

    // Output as JSON for CloudWatch
    const output = JSON.stringify(logEntry);

    // Use appropriate console method based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, metadata?: Record<string, any>): void {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      ...metadata,
    });
  }

  /**
   * Log API response
   */
  logResponse(method: string, path: string, statusCode: number, duration: number, metadata?: Record<string, any>): void {
    this.info(`API Response: ${method} ${path} - ${statusCode}`, {
      method,
      path,
      statusCode,
      duration,
      ...metadata,
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, table: string, duration: number, metadata?: Record<string, any>): void {
    this.debug(`Database: ${operation} on ${table}`, {
      operation,
      table,
      duration,
      ...metadata,
    });
  }

  /**
   * Log external service call
   */
  logExternalService(service: string, operation: string, duration: number, success: boolean, metadata?: Record<string, any>): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    this.log(level, `External Service: ${service} - ${operation}`, {
      service,
      operation,
      duration,
      success,
      ...metadata,
    });
  }
}

/**
 * Create a default logger instance
 */
export function createLogger(context?: LogContext): Logger {
  const minLevel = process.env.LOG_LEVEL as LogLevel || LogLevel.INFO;
  return new Logger(context, minLevel);
}

/**
 * Global logger instance (can be used for simple logging)
 */
export const logger = createLogger();
