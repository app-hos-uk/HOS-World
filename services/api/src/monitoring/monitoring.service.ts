import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

/**
 * Monitoring Service
 * 
 * Provides application performance monitoring (APM) capabilities.
 * Currently supports basic health checks and metrics collection.
 * 
 * Future enhancements:
 * - Sentry integration for error tracking
 * - New Relic / Datadog APM integration
 * - Distributed tracing
 */
@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private startTime: Date;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private responseTimeCount = 0;

  constructor(private configService: ConfigService) {
    this.startTime = new Date();
  }

  onModuleInit() {
    this.logger.log('Monitoring service initialized');
    
    // Initialize APM if configured
    const apmProvider = this.configService.get<string>('APM_PROVIDER');
    if (apmProvider) {
      this.initializeAPM(apmProvider);
    }
  }

  /**
   * Initialize APM provider
   */
  private initializeAPM(provider: string) {
    try {
      switch (provider.toLowerCase()) {
        case 'sentry':
          this.initializeSentry();
          break;
        case 'newrelic':
          this.initializeNewRelic();
          break;
        case 'datadog':
          this.initializeDatadog();
          break;
        default:
          this.logger.warn(`Unknown APM provider: ${provider}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to initialize APM: ${error?.message}`);
    }
  }

  /**
   * Initialize Sentry for error tracking
   */
  private initializeSentry() {
    const sentryDsn = this.configService.get<string>('SENTRY_DSN');
    if (!sentryDsn) {
      this.logger.warn('SENTRY_DSN not configured - Sentry disabled');
      return;
    }

    try {
      Sentry.init({
        dsn: sentryDsn,
        environment: this.configService.get<string>('NODE_ENV') || 'production',
        tracesSampleRate: parseFloat(this.configService.get<string>('SENTRY_TRACES_SAMPLE_RATE') || '0.1'),
        integrations: [new (Sentry as any).Integrations.Http({ tracing: true })],
      });

      this.logger.log('✅ Sentry error tracking enabled');
    } catch (error: any) {
      this.logger.error(`Failed to initialize Sentry: ${error?.message}`);
    }
  }

  /**
   * Initialize New Relic APM
   */
  private initializeNewRelic() {
    const licenseKey = this.configService.get<string>('NEW_RELIC_LICENSE_KEY');
    if (!licenseKey) {
      this.logger.warn('NEW_RELIC_LICENSE_KEY not configured - New Relic disabled');
      return;
    }

    this.logger.log('New Relic APM enabled');
  }

  /**
   * Initialize Datadog APM
   */
  private initializeDatadog() {
    const apiKey = this.configService.get<string>('DATADOG_API_KEY');
    if (!apiKey) {
      this.logger.warn('DATADOG_API_KEY not configured - Datadog disabled');
      return;
    }

    this.logger.log('Datadog APM enabled');
  }

  /**
   * Track request metrics
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
   * Get application metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime.getTime();
    const avgResponseTime = this.responseTimeCount > 0
      ? this.responseTimeSum / this.responseTimeCount
      : 0;
    const errorRate = this.requestCount > 0
      ? (this.errorCount / this.requestCount) * 100
      : 0;

    return {
      uptime: Math.floor(uptime / 1000), // seconds
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        success: this.requestCount - this.errorCount,
        errorRate: parseFloat(errorRate.toFixed(2)),
      },
      performance: {
        avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
        requestsPerSecond: this.requestCount > 0
          ? parseFloat((this.requestCount / (uptime / 1000)).toFixed(2))
          : 0,
      },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
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

  /**
   * Capture exception for monitoring
   */
  captureException(error: Error, context?: Record<string, any>) {
    this.errorCount++;
    this.logger.error(`Exception captured: ${error.message}`, error.stack);
    
    // Send to Sentry if configured
    try {
      const Sentry = require('@sentry/node');
      if (Sentry && Sentry.captureException) {
        Sentry.captureException(error, {
          contexts: {
            custom: context || {},
          },
        });
      }
    } catch (e) {
      // Sentry not installed or not initialized - ignore
    }
  }

  /**
   * Capture message for monitoring
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    this.logger[level](message);
    
    // Send to Sentry if configured
    try {
      const Sentry = require('@sentry/node');
      if (Sentry && Sentry.captureMessage) {
        const sentryLevel = level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info';
        Sentry.captureMessage(message, sentryLevel);
      }
    } catch (e) {
      // Sentry not installed or not initialized - ignore
    }
  }
}
