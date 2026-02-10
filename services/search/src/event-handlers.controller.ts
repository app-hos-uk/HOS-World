import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ElasticSearchService } from './elasticsearch/search.service';
import { MeilisearchService } from './meilisearch/meilisearch.service';
import { SearchPrismaService } from './database/prisma.service';

/**
 * Event Handlers for Search Service
 *
 * Listens for product domain events from the event bus and
 * keeps both Elasticsearch and Meilisearch indexes in sync.
 */
@Controller()
export class EventHandlersController {
  private readonly logger = new Logger(EventHandlersController.name);

  constructor(
    private readonly elasticSearch: ElasticSearchService,
    private readonly meilisearch: MeilisearchService,
    private readonly prisma: SearchPrismaService,
  ) {}

  @EventPattern('product.created')
  async handleProductCreated(@Payload() data: any) {
    this.logger.log(`Product created event received: ${data?.productId || data?.id}`);

    try {
      const productId = data?.productId || data?.id;
      if (!productId) return;

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          seller: { select: { id: true, storeName: true, slug: true } },
          images: { orderBy: { order: 'asc' }, take: 3 },
        },
      });

      if (!product) return;

      await Promise.allSettled([
        this.elasticSearch.indexProduct(product),
        this.meilisearch.indexProduct(product),
      ]);
    } catch (error: any) {
      this.logger.error(`Failed to handle product.created: ${error?.message}`);
    }
  }

  @EventPattern('product.updated')
  async handleProductUpdated(@Payload() data: any) {
    this.logger.log(`Product updated event received: ${data?.productId || data?.id}`);

    try {
      const productId = data?.productId || data?.id;
      if (!productId) return;

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          seller: { select: { id: true, storeName: true, slug: true } },
          images: { orderBy: { order: 'asc' }, take: 3 },
        },
      });

      if (!product) return;

      await Promise.allSettled([
        this.elasticSearch.updateProduct(product),
        this.meilisearch.indexProduct(product),
      ]);
    } catch (error: any) {
      this.logger.error(`Failed to handle product.updated: ${error?.message}`);
    }
  }

  @EventPattern('product.deleted')
  async handleProductDeleted(@Payload() data: any) {
    this.logger.log(`Product deleted event received: ${data?.productId || data?.id}`);

    try {
      const productId = data?.productId || data?.id;
      if (!productId) return;

      await Promise.allSettled([
        this.elasticSearch.deleteProduct(productId),
        this.meilisearch.deleteProduct(productId),
      ]);
    } catch (error: any) {
      this.logger.error(`Failed to handle product.deleted: ${error?.message}`);
    }
  }

  @EventPattern('product.price_changed')
  async handleProductPriceChanged(@Payload() data: any) {
    // Re-index the product when price changes
    await this.handleProductUpdated(data);
  }
}
