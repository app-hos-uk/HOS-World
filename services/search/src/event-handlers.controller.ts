import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  PRODUCT_EVENTS,
  DomainEvent,
  ProductCreatedPayload,
  ProductUpdatedPayload,
  ProductDeletedPayload,
  ProductPriceChangedPayload,
} from '@hos-marketplace/events';
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

  @EventPattern(PRODUCT_EVENTS.CREATED)
  async handleProductCreated(@Payload() event: DomainEvent<ProductCreatedPayload>) {
    const productId = event?.payload?.productId;
    this.logger.log(`Product created event received: ${productId}`);

    try {
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
      this.logger.error(`Failed to handle product.product.created: ${error?.message}`);
    }
  }

  @EventPattern(PRODUCT_EVENTS.UPDATED)
  async handleProductUpdated(@Payload() event: DomainEvent<ProductUpdatedPayload>) {
    const productId = event?.payload?.productId;
    this.logger.log(`Product updated event received: ${productId}`);

    try {
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
      this.logger.error(`Failed to handle product.product.updated: ${error?.message}`);
    }
  }

  @EventPattern(PRODUCT_EVENTS.DELETED)
  async handleProductDeleted(@Payload() event: DomainEvent<ProductDeletedPayload>) {
    const productId = event?.payload?.productId;
    this.logger.log(`Product deleted event received: ${productId}`);

    try {
      if (!productId) return;

      await Promise.allSettled([
        this.elasticSearch.deleteProduct(productId),
        this.meilisearch.deleteProduct(productId),
      ]);
    } catch (error: any) {
      this.logger.error(`Failed to handle product.product.deleted: ${error?.message}`);
    }
  }

  @EventPattern(PRODUCT_EVENTS.PRICE_CHANGED)
  async handleProductPriceChanged(@Payload() event: DomainEvent<ProductPriceChangedPayload>) {
    // Re-index the product when price changes
    await this.handleProductUpdated(event as any);
  }
}
