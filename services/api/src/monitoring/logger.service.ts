import { Injectable, LoggerService as NestLoggerService, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Enhanced Logger Service
 * 
 * Provides structured logging with correlation IDs and log levels.
 * Supports JSON logging for production environments.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger = new Logger('AppLogger');
  private correlationId: string | null = null;
  private enableJsonLogging: boolean;

  constructor(private configService: ConfigService) {
    this.enableJsonLogging = this.configService.get<string>('JSON_LOGGING') === 'true';
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  /**
   * Get correlation ID
   */
  getCorrelationId(): string | null {
    return this.correlationId;
  }

  /**
   * Format log message
   */
  private formatMessage(level: string, message: any, context?: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const logData: any = {
      timestamp,
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context: context || 'Application',
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

    // Human-readable format
    const correlation = this.correlationId ? `[${this.correlationId}]` : '';
    return `[${timestamp}] ${level.toUpperCase()} ${correlation} [${logData.context}] ${logData.message}`;
  }

  log(message: any, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('info', message, context, ...args);
    this.logger.log(formatted);
  }

  error(message: any, trace?: string, context?: string, ...args: any[]) {
    const formatted = this.formatMessage('error', message, context, trace, ...args);
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
   * Log with structured data
   */
  logWithData(level: 'info' | 'warn' | 'error' | 'debug', message: string, data: Record<string, any>, context?: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || 'Application',
      data,
      correlationId: this.correlationId,
    };

    if (this.enableJsonLogging) {
      this.logger[level](JSON.stringify(logEntry));
    } else {
      const dataStr = JSON.stringify(data, null, 2);
      this.logger[level](`${message}\n${dataStr}`, context);
    }
  }
}
