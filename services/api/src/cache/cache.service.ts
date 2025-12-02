import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern: string): Promise<void> {
    // This is Redis-specific, in-memory cache doesn't support patterns
    // Implementation depends on cache store
    const keys = await this.cacheManager.store.keys?.(pattern);
    if (keys && keys.length > 0) {
      await Promise.all(keys.map((key) => this.del(key)));
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

