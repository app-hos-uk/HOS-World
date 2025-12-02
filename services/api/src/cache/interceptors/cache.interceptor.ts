import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../cache.service';
import { Reflector } from '@nestjs/core';

export const CACHE_TTL_KEY = 'cache_ttl';
export const CACHE_KEY = 'cache_key';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private cacheService: CacheService,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(request);
    const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler());

    // Try to get from cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    // Execute handler and cache result
    return next.handle().pipe(
      tap((data) => {
        if (ttl) {
          this.cacheService.set(cacheKey, data, ttl);
        } else {
          this.cacheService.set(cacheKey, data);
        }
      }),
    );
  }

  private generateCacheKey(request: any): string {
    const { method, url, query, params, user } = request;
    
    // Create cache key from request details
    const keyParts = [
      method.toLowerCase(),
      url,
      JSON.stringify(query),
      JSON.stringify(params),
    ];

    // Include user ID if authenticated
    if (user?.id) {
      keyParts.push(`user:${user.id}`);
    }

    return `cache:${keyParts.join(':')}`;
  }
}

