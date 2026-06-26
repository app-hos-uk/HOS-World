import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class PaginationCapInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request?.query) {
      if (request.query.limit !== undefined) {
        const parsed = parseInt(request.query.limit, 10);
        request.query.limit = isNaN(parsed) || parsed <= 0
          ? DEFAULT_PAGE_SIZE
          : Math.min(parsed, MAX_PAGE_SIZE);
      }
      if (request.query.take !== undefined) {
        const parsed = parseInt(request.query.take, 10);
        request.query.take = isNaN(parsed) || parsed <= 0
          ? DEFAULT_PAGE_SIZE
          : Math.min(parsed, MAX_PAGE_SIZE);
      }
      if (request.query.pageSize !== undefined) {
        const parsed = parseInt(request.query.pageSize, 10);
        request.query.pageSize = isNaN(parsed) || parsed <= 0
          ? DEFAULT_PAGE_SIZE
          : Math.min(parsed, MAX_PAGE_SIZE);
      }
    }
    return next.handle();
  }
}
