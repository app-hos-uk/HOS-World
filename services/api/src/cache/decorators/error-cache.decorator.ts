import { SetMetadata } from '@nestjs/common';

export const ERROR_CACHE_KEY = 'error_cache';
export const ERROR_CACHE_OPTIONS = 'error_cache_options';

export interface ErrorCacheOptions {
  /**
   * Custom operation key for error caching
   * If not provided, will be auto-generated from method and URL
   */
  operationKey?: string;

  /**
   * Maximum number of failures before skipping operation
   * Default: 5
   */
  maxFailures?: number;

  /**
   * Whether to resolve error on success
   * Default: true
   */
  resolveOnSuccess?: boolean;

  /**
   * Custom TTL for error cache (in seconds)
   * Default: 3600 (1 hour)
   */
  ttl?: number;
}

/**
 * Decorator to enable error caching for a method or controller
 * 
 * @example
 * ```typescript
 * @ErrorCache({ maxFailures: 3 })
 * @Get(':id')
 * async getProduct(@Param('id') id: string) {
 *   return this.productsService.findOne(id);
 * }
 * ```
 */
export const ErrorCache = (options?: ErrorCacheOptions) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      // Method decorator
      SetMetadata(ERROR_CACHE_KEY, true)(target, propertyKey, descriptor);
      if (options) {
        SetMetadata(ERROR_CACHE_OPTIONS, options)(target, propertyKey, descriptor);
      }
    } else {
      // Class decorator
      SetMetadata(ERROR_CACHE_KEY, true)(target);
      if (options) {
        SetMetadata(ERROR_CACHE_OPTIONS, options)(target);
      }
    }
  };
};

