import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ProductPrismaService } from '../database/prisma.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(private prisma: ProductPrismaService) {}

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
    return this.prisma.product.create({ data, include: { images: true, seller: { select: { id: true, storeName: true, slug: true } } } });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data, include: { images: true, seller: { select: { id: true, storeName: true, slug: true } } } });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  // Taxonomy
  async getCategories() { return this.prisma.category.findMany({ where: { isActive: true }, include: { children: true }, orderBy: { order: 'asc' } }); }
  async getFandoms() { return this.prisma.fandom.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }); }
  async getCharacters() { return this.prisma.character.findMany({ orderBy: { name: 'asc' } }); }
  async getAttributes() { return this.prisma.attribute.findMany({ include: { values: true }, orderBy: { name: 'asc' } }); }
}
