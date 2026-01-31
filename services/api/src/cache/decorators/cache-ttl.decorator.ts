import { SetMetadata } from '@nestjs/common';
import { CACHE_TTL_KEY } from '../interceptors/cache.interceptor';

/**
 * Decorator to set cache TTL for an endpoint
 * @param ttl Time to live in seconds
 */
export const CacheTTL = (ttl: number) => SetMetadata(CACHE_TTL_KEY, ttl);
