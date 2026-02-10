import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * Monitoring Service
 *
 * Tracks application metrics (request counts, response times, error rates)
 * and integrates with Sentry for error tracking.
 *
 * Each microservice creates its own instance with service-specific context.
 */
@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger: Logger;
  private startTime: Date;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private responseTimeCount = 0;
  private readonly serviceName: string;

  constructor(serviceName: string = 'Application') {
    this.serviceName = serviceName;
    this.logger = new Logger(`${serviceName}:Monitoring`);
    this.startTime = new Date();
  }

  onModuleInit() {
    this.logger.log('Monitoring service initialized');
    this.initializeSentry();
  }

  /**
   * Initialize Sentry if SENTRY_DSN is configured
   */
  private initializeSentry() {
    const sentryDsn = process.env.SENTRY_DSN;
    if (!sentryDsn) {
      this.logger.debug('SENTRY_DSN not configured -- Sentry disabled');
      return;
    }

    try {
      Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || 'production',
        serverName: this.serviceName,
        tracesSampleRate: parseFloat(
          process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1',
        ),
      });
      this.logger.log('Sentry error tracking enabled');
    } catch (error: any) {
      this.logger.error(`Failed to initialize Sentry: ${error?.message}`);
    }
  }

  /**
   * Track a request (call from monitoring interceptor)
   */
  trackRequest(responseTime: number, success: boolean = true) {
    this.requestCount++;
    this.responseTimeSum += responseTime;
    this.responseTimeCount++;

    if (!success) {
      this.errorCount++;
    }
  }

  /**
   * Get application metrics snapshot
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime.getTime();
    const avgResponseTime =
      this.responseTimeCount > 0
        ? this.responseTimeSum / this.responseTimeCount
        : 0;
    const errorRate =
      this.requestCount > 0
        ? (this.errorCount / this.requestCount) * 100
        : 0;

    return {
      service: this.serviceName,
      uptime: Math.floor(uptime / 1000),
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        success: this.requestCount - this.errorCount,
        errorRate: parseFloat(errorRate.toFixed(2)),
      },
      performance: {
        avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
        requestsPerSecond:
          this.requestCount > 0
            ? parseFloat(
                (this.requestCount / (uptime / 1000)).toFixed(2),
              )
            : 0,
      },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Capture an exception for error tracking
   */
  captureException(error: Error, context?: Record<string, any>) {
    this.errorCount++;
    this.logger.error(`Exception captured: ${error.message}`, error.stack);

    try {
      if (Sentry.captureException) {
        Sentry.captureException(error, {
          contexts: {
            service: { name: this.serviceName },
            custom: context || {},
          },
        });
      }
    } catch {
      // Sentry not initialized -- ignore
    }
  }

  /**
   * Capture an informational/warning message
   */
  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
  ) {
    const logMethod = level === 'info' ? 'log' : level === 'warning' ? 'warn' : level;
    (this.logger as any)[logMethod](message);

    try {
      if (Sentry.captureMessage) {
        Sentry.captureMessage(message, level);
      }
    } catch {
      // Sentry not initialized -- ignore
    }
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeSum = 0;
    this.responseTimeCount = 0;
    this.startTime = new Date();
  }
}
