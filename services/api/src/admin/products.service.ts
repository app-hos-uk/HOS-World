import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { slugify } from '@hos-marketplace/utils';

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
    category?: string; // Keep for backward compatibility
    tags?: string[]; // Keep for backward compatibility
    categoryId?: string; // New: taxonomy category ID
    tagIds?: string[]; // New: taxonomy tag IDs
    attributes?: Array<{
      attributeId: string;
      attributeValueId?: string;
      textValue?: string;
      numberValue?: number;
      booleanValue?: boolean;
      dateValue?: string;
    }>; // New: product attributes
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

    // Validate categoryId if provided
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Validate tagIds if provided
    if (data.tagIds && data.tagIds.length > 0) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: data.tagIds } },
      });
      if (tags.length !== data.tagIds.length) {
        throw new BadRequestException('One or more tags not found');
      }
    }

    // Validate attributes if provided
    if (data.attributes && data.attributes.length > 0) {
      const attributeIds = [...new Set(data.attributes.map(a => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of data.attributes) {
        const attribute = attributes.find(a => a.id === attrDto.attributeId);
        if (!attribute) continue;

        if (attribute.type === 'SELECT' && attrDto.attributeValueId) {
          const valueExists = attribute.values.some(v => v.id === attrDto.attributeValueId);
          if (!valueExists) {
            throw new BadRequestException(`Attribute value not found for attribute ${attribute.name}`);
          }
        }
      }
    }

    // Generate slug
    const baseSlug = slugify(data.name);
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
        category: data.category, // Keep for backward compatibility
        tags: data.tags || [], // Keep for backward compatibility
        categoryId: data.categoryId, // New taxonomy field
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
        // New taxonomy relations
        tagsRelation: data.tagIds && data.tagIds.length > 0
          ? {
              create: data.tagIds.map(tagId => ({ tagId })),
            }
          : undefined,
        attributes: data.attributes && data.attributes.length > 0
          ? {
              create: data.attributes.map(attr => ({
                attributeId: attr.attributeId,
                attributeValueId: attr.attributeValueId,
                textValue: attr.textValue,
                numberValue: attr.numberValue,
                booleanValue: attr.booleanValue,
                dateValue: attr.dateValue ? new Date(attr.dateValue) : undefined,
              })),
            }
          : undefined,
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
        categoryRelation: true,
        tagsRelation: {
          include: {
            tag: true,
          },
        },
        attributes: {
          include: {
            attribute: true,
            attributeValue: true,
          },
        },
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
      category?: string; // Keep for backward compatibility
      tags?: string[]; // Keep for backward compatibility
      categoryId?: string; // New: taxonomy category ID
      tagIds?: string[]; // New: taxonomy tag IDs
      attributes?: Array<{
        attributeId: string;
        attributeValueId?: string;
        textValue?: string;
        numberValue?: number;
        booleanValue?: boolean;
        dateValue?: string;
      }>; // New: product attributes
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

    // Validate categoryId if provided
    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: data.categoryId },
        });
        if (!category) {
          throw new NotFoundException('Category not found');
        }
      }
    }

    // Validate tagIds if provided
    if (data.tagIds && data.tagIds.length > 0) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: data.tagIds } },
      });
      if (tags.length !== data.tagIds.length) {
        throw new BadRequestException('One or more tags not found');
      }
    }

    // Validate attributes if provided
    if (data.attributes && data.attributes.length > 0) {
      const attributeIds = [...new Set(data.attributes.map(a => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of data.attributes) {
        const attribute = attributes.find(a => a.id === attrDto.attributeId);
        if (!attribute) continue;

        if (attribute.type === 'SELECT' && attrDto.attributeValueId) {
          const valueExists = attribute.values.some(v => v.id === attrDto.attributeValueId);
          if (!valueExists) {
            throw new BadRequestException(`Attribute value not found for attribute ${attribute.name}`);
          }
        }
      }
    }

    // Update slug if name changed
    let slug = product.slug;
    if (data.name && data.name !== product.name) {
      const baseSlug = slugify(data.name);
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

    // Prepare update data
    const updateData: any = {
      ...data,
      slug,
    };

    // Handle tagsRelation update
    if (data.tagIds !== undefined) {
      // Delete existing tags
      await this.prisma.productTag.deleteMany({
        where: { productId },
      });
      // Create new tags
      if (data.tagIds.length > 0) {
        updateData.tagsRelation = {
          create: data.tagIds.map(tagId => ({ tagId })),
        };
      }
    }

    // Handle attributes update
    if (data.attributes !== undefined) {
      // Delete existing attributes
      await this.prisma.productAttribute.deleteMany({
        where: { productId },
      });
      // Create new attributes
      if (data.attributes.length > 0) {
        updateData.attributes = {
          create: data.attributes.map(attr => ({
            attributeId: attr.attributeId,
            attributeValueId: attr.attributeValueId,
            textValue: attr.textValue,
            numberValue: attr.numberValue,
            booleanValue: attr.booleanValue,
            dateValue: attr.dateValue ? new Date(attr.dateValue) : undefined,
          })),
        };
      }
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        images: true,
        categoryRelation: true,
        tagsRelation: {
          include: {
            tag: true,
          },
        },
        attributes: {
          include: {
            attribute: true,
            attributeValue: true,
          },
        },
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

}

