import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MonitoringService } from './monitoring.service';
import { LoggerService } from './logger.service';
import { randomUUID } from 'crypto';

/**
 * Monitoring Interceptor
 *
 * Tracks request metrics, response times, errors, and propagates correlation IDs
 * for distributed tracing across microservices.
 *
 * Register globally in each microservice:
 *   { provide: APP_INTERCEPTOR, useClass: MonitoringInterceptor }
 */
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(
    private monitoringService: MonitoringService,
    private loggerService: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    // Propagate or generate correlation ID
    const correlationId =
      request.headers['x-correlation-id'] ||
      request.headers['x-request-id'] ||
      randomUUID();
    this.loggerService.setCorrelationId(correlationId);

    // Ensure correlation ID is in the response headers
    const response = context.switchToHttp().getResponse();
    if (response?.setHeader) {
      response.setHeader('X-Correlation-ID', correlationId);
    }

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.monitoringService.trackRequest(responseTime, true);
        this.loggerService.debug(
          `${method} ${url} - ${responseTime}ms`,
          'MonitoringInterceptor',
        );
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        this.monitoringService.trackRequest(responseTime, false);
        this.monitoringService.captureException(error, {
          method,
          url,
          correlationId,
        });
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
