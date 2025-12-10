import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ErrorCacheService } from '../error-cache.service';

@Injectable()
export class ErrorCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorCacheInterceptor.name);

  constructor(private errorCacheService: ErrorCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;
    
    // Generate operation key from request
    const operationKey = this.generateOperationKey(method, url, user?.id);

    // Context for error logging
    const errorContext = {
      method,
      url,
      userId: user?.id,
      timestamp: new Date().toISOString(),
    };

    return next.handle().pipe(
      tap(() => {
        // On success, resolve any previous errors
        this.errorCacheService.resolveError(operationKey).catch((err) => {
          this.logger.debug(`Failed to resolve error for ${operationKey}: ${err.message}`);
        });
      }),
      catchError((error) => {
        // Cache the error
        this.errorCacheService
          .cacheError(operationKey, error, errorContext)
          .catch((err) => {
            this.logger.error(`Failed to cache error: ${err.message}`);
          });

        return throwError(() => error);
      }),
    );
  }

  private generateOperationKey(method: string, url: string, userId?: string): string {
    // Remove query params and normalize URL
    const normalizedUrl = url.split('?')[0].replace(/\/\d+/g, '/:id');
    return `${method.toLowerCase()}:${normalizedUrl}${userId ? `:user:${userId}` : ''}`;
  }
}

