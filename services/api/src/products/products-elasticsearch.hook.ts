import { Injectable } from '@nestjs/common';
import { SearchService } from '../search/search.service';
import { CacheService } from '../cache/cache.service';

/**
 * Hook to sync products with Elasticsearch and cache
 * This should be called after product create/update/delete operations
 */
@Injectable()
export class ProductsElasticsearchHook {
  constructor(
    private searchService: SearchService,
    private cacheService: CacheService,
  ) {}

  /**
   * Index product in Elasticsearch and cache
   */
  async onProductCreated(product: any): Promise<void> {
    // Index in Elasticsearch
    await this.searchService.indexProduct(product);

    // Cache product
    await this.cacheService.setProduct(product.id, product);

    // Invalidate product list caches
    await this.cacheService.delPattern('products:*');
  }

  /**
   * Update product in Elasticsearch and cache
   */
  async onProductUpdated(product: any): Promise<void> {
    // Update in Elasticsearch
    await this.searchService.updateProduct(product);

    // Update cache
    await this.cacheService.setProduct(product.id, product);

    // Invalidate product list caches
    await this.cacheService.delPattern('products:*');
  }

  /**
   * Delete product from Elasticsearch and cache
   */
  async onProductDeleted(productId: string): Promise<void> {
    // Delete from Elasticsearch
    await this.searchService.deleteProduct(productId);

    // Delete from cache
    await this.cacheService.invalidateProduct(productId);
  }
}
