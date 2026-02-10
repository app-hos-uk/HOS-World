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
  private correlationId: string | null = null;
  private readonly enableJsonLogging: boolean;
  private readonly serviceName: string;

  constructor(serviceName: string = 'Application') {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
    this.enableJsonLogging = process.env.JSON_LOGGING === 'true';
  }

  /**
   * Set correlation ID for request tracking across services
   */
  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | null {
    return this.correlationId;
  }

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
    };

    if (this.correlationId) {
      logData.correlationId = this.correlationId;
    }

    if (args.length > 0) {
      logData.metadata = args;
    }

    if (this.enableJsonLogging) {
      return JSON.stringify(logData);
    }

    const correlation = this.correlationId
      ? `[${this.correlationId}]`
      : '';
    return `[${timestamp}] ${level.toUpperCase()} ${correlation} [${logData.context}] ${logData.message}`;
  }

  log(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('info', message, context, ...args);
    this.logger.log(formatted);
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    const formatted = this.formatMessage(
      'error',
      message,
      context,
      trace,
      ...args,
    );
    this.logger.error(formatted);
  }

  warn(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('warn', message, context, ...args);
    this.logger.warn(formatted);
  }

  debug(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('debug', message, context, ...args);
    this.logger.debug(formatted);
  }

  verbose(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('verbose', message, context, ...args);
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
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      context: context || this.serviceName,
      data,
      correlationId: this.correlationId,
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
