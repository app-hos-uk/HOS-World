import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { LoggerService } from './logger.service';

/**
 * Monitoring Interceptor
 * 
 * Tracks request metrics, response times, and errors for monitoring.
 */
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(
    private monitoringService: MonitoringService,
    private metricsService: MetricsService,
    private loggerService: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, route } = request;
    const startTime = Date.now();

    // Set correlation ID if present in headers
    const correlationId = request.headers['x-correlation-id'] || 
                          request.headers['x-request-id'] ||
                          `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.loggerService.setCorrelationId(correlationId);

    // Track request
    this.metricsService.incrementCounter('http_requests_total');

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.monitoringService.trackRequest(responseTime, true);
        this.metricsService.recordHistogram('http_request_duration_seconds', responseTime / 1000);
        
        // Log successful request
        this.loggerService.debug(
          `${method} ${url} - ${responseTime}ms`,
          'MonitoringInterceptor',
        );
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        this.monitoringService.trackRequest(responseTime, false);
        this.metricsService.incrementCounter('http_errors_total');
        this.monitoringService.captureException(error, {
          method,
          url,
          route: route?.path,
          correlationId,
        });

        // Log error
        this.loggerService.error(
          `${method} ${url} - ${responseTime}ms - Error: ${error.message}`,
          error.stack,
          'MonitoringInterceptor',
        );

        return throwError(() => error);
      }),
    );
  }
}
