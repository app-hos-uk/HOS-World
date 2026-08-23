import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/** Stored in place of `null` because cache-manager rejects null/undefined. */
export const CACHE_NONE_SENTINEL = { __hosCacheNone: true as const };

function isCacheNone(value: unknown): value is typeof CACHE_NONE_SENTINEL {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { __hosCacheNone?: unknown }).__hosCacheNone === true
  );
}

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get value from cache.
   * `undefined` = miss, `null` = cached absence (e.g. no tax zone).
   */
  async get<T>(key: string): Promise<T | null | undefined> {
    const value = await this.cacheManager.get<T | typeof CACHE_NONE_SENTINEL>(key);
    if (value === undefined) return undefined;
    if (isCacheNone(value)) return null;
    return value as T;
  }

  /**
   * Set value in cache. `null` is stored as a sentinel so "not found" can be cached
   * without cache-manager throwing "not a cacheable value". `undefined` is skipped.
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (value === undefined) return;
    await this.cacheManager.set(key, value === null ? CACHE_NONE_SENTINEL : value, ttl);
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Delete multiple keys matching pattern.
   * Delegates to the store's own `keys()` which handles prefixes and
   * uses SCAN internally on Redis-backed stores (cache-manager-redis-yet).
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const store = this.cacheManager.store as any;
      const keys = await store?.keys?.(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map((key: string) => this.del(key)));
      }
    } catch {
      // Silently degrade — cache invalidation failure is non-fatal
    }
  }

  /**
   * Reset entire cache
   */
  async reset(): Promise<void> {
    await this.cacheManager.reset();
  }

  // Product-specific cache helpers
  async getProduct(productId: string) {
    return this.get(`product:${productId}`);
  }

  async setProduct(productId: string, product: any, ttl = 3600) {
    await this.set(`product:${productId}`, product, ttl);
  }

  async invalidateProduct(productId: string) {
    await this.del(`product:${productId}`);
    // Also invalidate product list caches
    await this.delPattern('products:*');
  }

  async getProductsList(key: string) {
    return this.get(`products:${key}`);
  }

  async setProductsList(key: string, products: any[], ttl = 1800) {
    await this.set(`products:${key}`, products, ttl);
  }

  async getSeller(sellerId: string) {
    return this.get(`seller:${sellerId}`);
  }

  async setSeller(sellerId: string, seller: any, ttl = 3600) {
    await this.set(`seller:${sellerId}`, seller, ttl);
  }

  async invalidateSeller(sellerId: string) {
    await this.del(`seller:${sellerId}`);
    await this.delPattern('sellers:*');
  }
}
