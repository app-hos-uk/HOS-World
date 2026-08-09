import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { LoggerService } from './logger.service';

/** 401/403/404 are the ordinary traffic of a public API and would drown out the rest. */
const ROUTINE_CLIENT_STATUSES: number[] = [
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
];

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
    const correlationId =
      request.headers['x-correlation-id'] ||
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
        this.loggerService.debug(`${method} ${url} - ${responseTime}ms`, 'MonitoringInterceptor');
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const status =
          error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        const isServerError = status >= 500;

        // A rejected request is still a served request. Counting 4xx as failures made the error
        // rate track how many callers sent bad input rather than whether the service is healthy.
        this.monitoringService.trackRequest(responseTime, !isServerError);
        this.metricsService.incrementCounter(
          isServerError ? 'http_errors_total' : 'http_client_errors_total',
        );

        if (isServerError) {
          this.monitoringService.captureException(error, {
            method,
            url,
            route: route?.path,
            correlationId,
          });
          this.loggerService.error(
            `${method} ${url} - ${responseTime}ms - Error: ${error.message}`,
            error.stack,
            'MonitoringInterceptor',
          );
        } else {
          // No stack and no Sentry: the caller is at fault, and the message is the whole story.
          const line = `${method} ${url} - ${responseTime}ms - ${status}: ${error.message}`;
          if (ROUTINE_CLIENT_STATUSES.includes(status)) {
            this.loggerService.debug(line, 'MonitoringInterceptor');
          } else {
            this.loggerService.warn(line, 'MonitoringInterceptor');
          }
        }

        return throwError(() => error);
      }),
    );
  }
}
