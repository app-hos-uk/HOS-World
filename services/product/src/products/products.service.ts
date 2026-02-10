import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventBusService, PRODUCT_EVENTS } from '@hos-marketplace/events';
import { ProductPrismaService } from '../database/prisma.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private prisma: ProductPrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(query: { page?: number; limit?: number; sellerId?: string; categoryId?: string; status?: string; fandom?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const where: any = {};
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.fandom) where.fandom = query.fandom;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip: (page - 1) * limit, take: limit, include: { images: { orderBy: { order: 'asc' }, take: 3 }, seller: { select: { id: true, storeName: true, slug: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count({ where }),
    ]);
    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { order: 'asc' } }, variations: true, attributes: { include: { attribute: true, attributeValue: true } }, seller: { select: { id: true, storeName: true, slug: true } }, bundleItems: true, volumePricings: { orderBy: { minQuantity: 'asc' } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { images: { orderBy: { order: 'asc' } }, variations: true, attributes: { include: { attribute: true, attributeValue: true } }, seller: { select: { id: true, storeName: true, slug: true } }, bundleItems: true, volumePricings: { orderBy: { minQuantity: 'asc' } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(data: any) {
    const product = await this.prisma.product.create({ data, include: { images: true, seller: { select: { id: true, storeName: true, slug: true } } } });

    // Emit product.product.created event
    try {
      this.eventBus.emit(PRODUCT_EVENTS.CREATED, {
        productId: product.id,
        sellerId: product.sellerId,
        name: product.name,
        slug: product.slug,
        price: Number(product.price || 0),
        currency: product.currency || 'GBP',
        status: product.status,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit product.created event: ${e?.message}`);
    }

    return product;
  }

  async update(id: string, data: any) {
    const existing = await this.findOne(id);
    const product = await this.prisma.product.update({ where: { id }, data, include: { images: true, seller: { select: { id: true, storeName: true, slug: true } } } });

    // Emit product.product.updated event
    try {
      this.eventBus.emit(PRODUCT_EVENTS.UPDATED, {
        productId: product.id,
        changes: data,
      });

      // If price changed, emit a dedicated price change event
      if (data.price !== undefined && Number(data.price) !== Number(existing.price)) {
        this.eventBus.emit(PRODUCT_EVENTS.PRICE_CHANGED, {
          productId: product.id,
          oldPrice: Number(existing.price),
          newPrice: Number(product.price),
          currency: product.currency || 'GBP',
        });
      }
    } catch (e: any) {
      this.logger.warn(`Failed to emit product.updated event: ${e?.message}`);
    }

    return product;
  }

  async delete(id: string) {
    const product = await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });

    // Emit product.product.deleted event
    try {
      this.eventBus.emit(PRODUCT_EVENTS.DELETED, {
        productId: id,
        sellerId: product.sellerId,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit product.deleted event: ${e?.message}`);
    }
  }

  // Taxonomy
  async getCategories() { return this.prisma.category.findMany({ where: { isActive: true }, include: { children: true }, orderBy: { order: 'asc' } }); }
  async getFandoms() { return this.prisma.fandom.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }); }
  async getCharacters() { return this.prisma.character.findMany({ orderBy: { name: 'asc' } }); }
  async getAttributes() { return this.prisma.attribute.findMany({ include: { values: true }, orderBy: { name: 'asc' } }); }
}
