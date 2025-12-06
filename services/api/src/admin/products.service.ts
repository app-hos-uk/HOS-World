import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class AdminProductsService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async createProduct(data: {
    name: string;
    description: string;
    price: number;
    currency?: string;
    stock?: number;
    category?: string;
    tags?: string[];
    sellerId?: string | null;
    isPlatformOwned?: boolean;
    status?: 'DRAFT' | 'PUBLISHED';
    sku?: string;
    barcode?: string;
    ean?: string;
    tradePrice?: number;
    rrp?: number;
    taxRate?: number;
    fandom?: string;
  }) {
    // Validate: if sellerId is provided, seller must exist
    if (data.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: data.sellerId },
      });
      if (!seller) {
        throw new NotFoundException('Seller not found');
      }
    }

    // If platform-owned, sellerId must be null
    if (data.isPlatformOwned) {
      data.sellerId = null;
    }

    // Generate slug
    const baseSlug = this.slugify(data.name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.product.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create product
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        slug,
        price: data.price,
        currency: data.currency || 'GBP',
        stock: data.stock || 0,
        category: data.category,
        tags: data.tags || [],
        sellerId: data.sellerId,
        isPlatformOwned: data.isPlatformOwned || false,
        status: data.status || 'DRAFT',
        sku: data.sku,
        barcode: data.barcode,
        ean: data.ean,
        tradePrice: data.tradePrice,
        rrp: data.rrp,
        taxRate: data.taxRate || 0,
        fandom: data.fandom,
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        images: true,
      },
    });

    return product;
  }

  async updateProduct(
    productId: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      category?: string;
      tags?: string[];
      sellerId?: string | null;
      status?: 'DRAFT' | 'PUBLISHED';
      sku?: string;
      barcode?: string;
      ean?: string;
      tradePrice?: number;
      rrp?: number;
      taxRate?: number;
      fandom?: string;
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // If updating sellerId, validate seller exists
    if (data.sellerId !== undefined) {
      if (data.sellerId && data.sellerId !== product.sellerId) {
        const seller = await this.prisma.seller.findUnique({
          where: { id: data.sellerId },
        });
        if (!seller) {
          throw new NotFoundException('Seller not found');
        }
      }
    }

    // Update slug if name changed
    let slug = product.slug;
    if (data.name && data.name !== product.name) {
      const baseSlug = this.slugify(data.name);
      slug = baseSlug;
      let counter = 1;

      while (
        await this.prisma.product.findFirst({
          where: { slug, id: { not: productId } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...data,
        slug,
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        images: true,
      },
    });

    return updated;
  }

  async getAllProducts(filters?: {
    sellerId?: string;
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    } else if (filters?.sellerId === null) {
      // Platform-owned products
      where.sellerId = null;
      where.isPlatformOwned = true;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
          images: {
            take: 1,
          },
          _count: {
            select: {
              orderItems: true,
              reviews: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
}

