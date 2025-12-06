import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import type { Product, PaginatedResponse } from '@hos-marketplace/shared-types';
import { Prisma } from '@prisma/client';
import { slugify } from '@hos-marketplace/utils';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(sellerId: string, createProductDto: CreateProductDto): Promise<Product> {
    // Verify seller exists
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Generate slug
    const baseSlug = slugify(createProductDto.name);
    let slug = baseSlug;
    let counter = 1;

    while (
      await this.prisma.product.findUnique({
        where: { sellerId_slug: { sellerId: seller.id, slug } },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create product
    const product = await this.prisma.product.create({
      data: {
        sellerId: seller.id,
        name: createProductDto.name,
        description: createProductDto.description,
        slug,
        sku: createProductDto.sku,
        barcode: createProductDto.barcode,
        ean: createProductDto.ean,
        price: createProductDto.price,
        tradePrice: createProductDto.tradePrice,
        rrp: createProductDto.rrp,
        currency: createProductDto.currency || 'USD',
        taxRate: createProductDto.taxRate || 0,
        stock: createProductDto.stock,
        fandom: createProductDto.fandom,
        category: createProductDto.category,
        tags: createProductDto.tags || [],
        status: createProductDto.status || 'DRAFT',
        images: {
          create: createProductDto.images.map((img, index) => ({
            url: img.url,
            alt: img.alt,
            order: img.order ?? index,
            type: (img.type as any) || 'IMAGE',
          })),
        },
        variations: createProductDto.variations
          ? {
              create: createProductDto.variations.map((variation) => ({
                name: variation.name,
                options: variation.options as any,
              })),
            }
          : undefined,
      },
      include: {
        images: true,
        variations: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    return this.mapToProductType(product);
  }

  async findAll(searchDto: SearchProductsDto): Promise<PaginatedResponse<Product>> {
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
    };

    if (searchDto.query) {
      where.OR = [
        { name: { contains: searchDto.query, mode: 'insensitive' } },
        { description: { contains: searchDto.query, mode: 'insensitive' } },
        { fandom: { contains: searchDto.query, mode: 'insensitive' } },
      ];
    }

    if (searchDto.fandom) {
      where.fandom = searchDto.fandom;
    }

    if (searchDto.category) {
      where.category = searchDto.category;
    }

    if (searchDto.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { userId: searchDto.sellerId },
      });
      if (seller) {
        where.sellerId = seller.id;
      }
    }

    if (searchDto.minPrice !== undefined || searchDto.maxPrice !== undefined) {
      where.price = {};
      if (searchDto.minPrice !== undefined) {
        where.price.gte = searchDto.minPrice;
      }
      if (searchDto.maxPrice !== undefined) {
        where.price.lte = searchDto.maxPrice;
      }
    }

    if (searchDto.inStock !== undefined) {
      if (searchDto.inStock) {
        where.stock = { gt: 0 };
      } else {
        where.stock = 0;
      }
    }

    // Build orderBy
    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (searchDto.sortBy) {
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'popular':
        // TODO: Implement popularity based on sales/views
        orderBy = { createdAt: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    // Execute query
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          images: {
            orderBy: { order: 'asc' },
          },
          variations: true,
          // Seller information hidden for identity privacy
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.mapToProductType(p, false)), // Hide seller info in listings
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, includeSeller: boolean = false): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        variations: true,
        ...(includeSeller ? {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
        } : {}),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapToProductType(product, includeSeller);
  }

  async findBySlug(sellerSlug: string, productSlug: string, includeSeller: boolean = false): Promise<Product> {
    const seller = await this.prisma.seller.findUnique({
      where: { slug: sellerSlug },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const product = await this.prisma.product.findUnique({
      where: {
        sellerId_slug: {
          sellerId: seller.id,
          slug: productSlug,
        },
      },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        variations: true,
        ...(includeSeller ? {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
        } : {}),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapToProductType(product, includeSeller);
  }

  async findBySlugOnly(slug: string, includeSeller: boolean = false): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { slug },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        variations: true,
        ...(includeSeller ? {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
        } : {}),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapToProductType(product, includeSeller);
  }

  async update(
    sellerId: string,
    productId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    // Verify product exists and belongs to seller
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller || product.sellerId !== seller.id) {
      throw new ForbiddenException('You do not have permission to update this product');
    }

    // Update product
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: updateProductDto.name,
        description: updateProductDto.description,
        sku: updateProductDto.sku,
        barcode: updateProductDto.barcode,
        ean: updateProductDto.ean,
        price: updateProductDto.price,
        tradePrice: updateProductDto.tradePrice,
        rrp: updateProductDto.rrp,
        currency: updateProductDto.currency,
        taxRate: updateProductDto.taxRate,
        stock: updateProductDto.stock,
        fandom: updateProductDto.fandom,
        category: updateProductDto.category,
        tags: updateProductDto.tags,
        status: updateProductDto.status,
      },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        variations: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    return this.mapToProductType(updated);
  }

  async delete(sellerId: string, productId: string): Promise<void> {
    // Verify product exists and belongs to seller
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller || product.sellerId !== seller.id) {
      throw new ForbiddenException('You do not have permission to delete this product');
    }

    await this.prisma.product.delete({
      where: { id: productId },
    });
  }

  private mapToProductType(product: any, includeSeller: boolean = false): Product {
    const mapped: any = {
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      sku: product.sku || undefined,
      barcode: product.barcode || undefined,
      ean: product.ean || undefined,
      price: Number(product.price),
      tradePrice: product.tradePrice ? Number(product.tradePrice) : undefined,
      rrp: product.rrp ? Number(product.rrp) : undefined,
      currency: product.currency,
      taxRate: Number(product.taxRate),
      stock: product.stock,
      images: product.images.map((img: any) => ({
        id: img.id,
        url: img.url,
        alt: img.alt || undefined,
        order: img.order,
        type: img.type.toLowerCase() as any,
      })),
      variations: product.variations?.map((v: any) => ({
        id: v.id,
        name: v.name,
        options: Array.isArray(v.options) ? v.options : [],
      })),
      fandom: product.fandom || undefined,
      category: product.category || undefined,
      tags: product.tags || [],
      status: product.status.toLowerCase() as any,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    // Only include seller information if explicitly requested (e.g., at payment page)
    if (includeSeller && product.seller) {
      mapped.sellerId = product.seller.userId || product.seller.id;
      mapped.seller = {
        id: product.seller.id,
        storeName: product.seller.storeName,
        slug: product.seller.slug,
      };
    }

    return mapped as Product;
  }
}
