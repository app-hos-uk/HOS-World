import { Injectable, LoggerService as NestLoggerService, Logger } from '@nestjs/common';

/**
 * Structured Logger Service
 *
 * Provides structured logging with correlation IDs and JSON output for production.
 * Each microservice uses this logger for consistent log formatting.
 *
 * Features:
 * - Correlation ID propagation for distributed tracing
 * - JSON logging mode for production (parseable by log aggregators)
 * - Human-readable mode for development
 * - Service name tagging
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: Logger;
  private readonly enableJsonLogging: boolean;
  private readonly serviceName: string;

  constructor(serviceName: string = 'Application') {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
    this.enableJsonLogging = process.env.JSON_LOGGING === 'true';
  }

  /**
   * Create a child logger bound to a specific correlation ID.
   * Use this per-request to avoid shared mutable state across
   * concurrent requests (the singleton LoggerService is shared).
   */
  withCorrelationId(correlationId: string): RequestScopedLogger {
    return new RequestScopedLogger(
      this.logger,
      this.serviceName,
      this.enableJsonLogging,
      correlationId,
    );
  }

  private formatMessage(
    level: string,
    message: any,
    correlationId: string | null,
    context?: string,
    ...args: any[]
  ) {
    const timestamp = new Date().toISOString();
    const logData: Record<string, any> = {
      timestamp,
      level,
      service: this.serviceName,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context: context || this.serviceName,
    };

    if (correlationId) {
      logData.correlationId = correlationId;
    }

    if (args.length > 0) {
      logData.metadata = args;
    }

    if (this.enableJsonLogging) {
      return JSON.stringify(logData);
    }

    const correlation = correlationId
      ? `[${correlationId}]`
      : '';
    return `[${timestamp}] ${level.toUpperCase()} ${correlation} [${logData.context}] ${logData.message}`;
  }

  log(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('info', message, null, context, ...args);
    this.logger.log(formatted);
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    const formatted = this.formatMessage(
      'error',
      message,
      null,
      context,
      trace,
      ...args,
    );
    this.logger.error(formatted);
  }

  warn(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('warn', message, null, context, ...args);
    this.logger.warn(formatted);
  }

  debug(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('debug', message, null, context, ...args);
    this.logger.debug(formatted);
  }

  verbose(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('verbose', message, null, context, ...args);
    this.logger.verbose(formatted);
  }

  /**
   * Log with structured data (for metrics, audit trails, etc.)
   */
  logWithData(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    data: Record<string, any>,
    context?: string,
    correlationId?: string,
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      context: context || this.serviceName,
      data,
      correlationId: correlationId || undefined,
    };

    const logMethod = level === 'info' ? 'log' : level;
    if (this.enableJsonLogging) {
      (this.logger as any)[logMethod](JSON.stringify(logEntry));
    } else {
      const dataStr = JSON.stringify(data, null, 2);
      (this.logger as any)[logMethod](`${message}\n${dataStr}`, context);
    }
  }
}

/**
 * Request-scoped logger bound to a specific correlation ID.
 *
 * Created per-request via `loggerService.withCorrelationId(id)`.
 * This avoids the singleton LoggerService storing mutable state
 * that would be overwritten by concurrent requests.
 */
export class RequestScopedLogger {
  constructor(
    private readonly logger: Logger,
    private readonly serviceName: string,
    private readonly enableJsonLogging: boolean,
    public readonly correlationId: string,
  ) {}

  private formatMessage(
    level: string,
    message: any,
    context?: string,
    ...args: any[]
  ) {
    const timestamp = new Date().toISOString();
    const logData: Record<string, any> = {
      timestamp,
      level,
      service: this.serviceName,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context: context || this.serviceName,
      correlationId: this.correlationId,
    };

    if (args.length > 0) {
      logData.metadata = args;
    }

    if (this.enableJsonLogging) {
      return JSON.stringify(logData);
    }

    return `[${timestamp}] ${level.toUpperCase()} [${this.correlationId}] [${logData.context}] ${logData.message}`;
  }

  log(message: any, context?: string, ...args: any[]) {
    this.logger.log(this.formatMessage('info', message, context, ...args));
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    this.logger.error(this.formatMessage('error', message, context, trace, ...args));
  }

  warn(message: any, context?: string, ...args: any[]) {
    this.logger.warn(this.formatMessage('warn', message, context, ...args));
  }

  debug(message: any, context?: string, ...args: any[]) {
    this.logger.debug(this.formatMessage('debug', message, context, ...args));
  }

  verbose(message: any, context?: string, ...args: any[]) {
    this.logger.verbose(this.formatMessage('verbose', message, context, ...args));
  }
}
