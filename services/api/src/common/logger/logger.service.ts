import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

@Injectable()
export class Logger implements NestLoggerService {
  private readonly logLevel: LogLevel;
  private readonly isDevelopment: boolean;
  private readonly suppressNestRouteLogs: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.logLevel = LogLevel[envLogLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
    // In production, Nest can emit hundreds of "Mapped { ... } route" lines on startup (RouterExplorer),
    // which can trigger Railway's log rate limiting. Default to suppressing those unless explicitly disabled.
    this.suppressNestRouteLogs =
      !this.isDevelopment && process.env.SUPPRESS_NEST_ROUTE_LOGS !== 'false';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private shouldSuppress(message: string, context?: string): boolean {
    if (!this.suppressNestRouteLogs) return false;
    // Suppress Nest route mapping spam on startup.
    if (context === 'RouterExplorer' && message.startsWith('Mapped {')) return true;
    return false;
  }

  private formatMessage(level: string, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    return `${timestamp} ${level} ${contextStr} ${message}`;
  }

  debug(message: string, context?: string) {
    if (this.shouldLog(LogLevel.DEBUG) || this.isDevelopment) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  log(message: string, context?: string) {
    if (this.shouldLog(LogLevel.INFO)) {
      if (this.shouldSuppress(message, context)) return;
      console.log(this.formatMessage('INFO', message, context));
    }
  }

  info(message: string, context?: string) {
    this.log(message, context);
  }

  warn(message: string, context?: string) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, trace?: string, context?: string) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context));
      if (trace) {
        console.error('Trace:', trace);
      }
    }
  }

  verbose(message: string, context?: string) {
    this.debug(message, context);
  }
}
