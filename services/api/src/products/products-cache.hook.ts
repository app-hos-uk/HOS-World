import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

/**
 * Hook to keep product cache in sync after create/update/delete.
 * Search indexing is handled by the search microservice via domain events.
 */
@Injectable()
export class ProductsCacheHook {
  constructor(private readonly cacheService: CacheService) {}

  async onProductCreated(product: any): Promise<void> {
    if (typeof product === 'string') {
      await this.cacheService.invalidateProduct(product);
      await this.cacheService.delPattern('products:*');
      return;
    }
    await this.cacheService.setProduct(product.id, product);
    await this.cacheService.delPattern('products:*');
  }

  async onProductUpdated(product: any): Promise<void> {
    await this.cacheService.setProduct(product.id, product);
    await this.cacheService.delPattern('products:*');
  }

  async onProductDeleted(productId: string): Promise<void> {
    await this.cacheService.invalidateProduct(productId);
    await this.cacheService.delPattern('products:*');
  }

  async onListCacheInvalidated(): Promise<void> {
    await this.cacheService.delPattern('products:*');
  }
}
