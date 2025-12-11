import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from './cache.service';

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async onModuleInit() {
    // Warm cache in background (don't block startup)
    this.warmCache().catch((err) => {
      this.logger.error('Failed to warm cache on startup', err);
    });
  }

  /**
   * Warm cache with popular products and categories
   */
  async warmCache() {
    try {
      this.logger.log('🔥 Starting cache warming...');

      // Warm popular products (first 50 active products)
      await this.warmPopularProducts();

      // Warm categories
      await this.warmCategories();

      // Warm sellers (top 20)
      await this.warmSellers();

      this.logger.log('✅ Cache warming completed');
    } catch (error) {
      this.logger.error('❌ Cache warming failed', error);
    }
  }

  /**
   * Warm popular products cache
   */
  private async warmPopularProducts() {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
        },
        take: 50,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          fandom: true,
          slug: true,
          images: {
            select: {
              url: true,
              order: true,
            },
            orderBy: { order: 'asc' },
            take: 1,
          },
          categoryRelation: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      // Cache individual products
      for (const product of products) {
        await this.cacheService.setProduct(product.id, product, 3600); // 1 hour TTL
      }

      // Cache product list
      await this.cacheService.setProductsList('popular', products, 1800); // 30 minutes TTL

      this.logger.log(`✅ Warmed ${products.length} popular products`);
    } catch (error) {
      this.logger.error('Failed to warm popular products', error);
    }
  }

  /**
   * Warm categories cache
   */
  private async warmCategories() {
    try {
      const categories = await this.prisma.category.findMany({
        where: {
          isActive: true,
        },
        take: 100,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      });

      await this.cacheService.set('categories:all', categories, 7200); // 2 hours TTL
      this.logger.log(`✅ Warmed ${categories.length} categories`);
    } catch (error) {
      this.logger.error('Failed to warm categories', error);
    }
  }

  /**
   * Warm sellers cache
   */
  private async warmSellers() {
    try {
      const sellers = await this.prisma.seller.findMany({
        where: {
          verified: true,
        },
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          storeName: true,
          slug: true,
          sellerType: true,
        },
      });

      for (const seller of sellers) {
        await this.cacheService.setSeller(seller.id, seller, 3600); // 1 hour TTL
      }

      await this.cacheService.set('sellers:top', sellers, 1800); // 30 minutes TTL
      this.logger.log(`✅ Warmed ${sellers.length} sellers`);
    } catch (error) {
      this.logger.error('Failed to warm sellers', error);
    }
  }

  /**
   * Manually trigger cache warming (can be called via API)
   */
  async warmCacheNow() {
    await this.warmCache();
  }
}

