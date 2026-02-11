import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { ProductsCacheHook } from '../products/products-cache.hook';
import { slugify } from '@hos-marketplace/utils';

@Injectable()
export class AdminProductsService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private cacheHook: ProductsCacheHook,
  ) {}

  async createProduct(data: {
    name: string;
    description: string;
    shortDescription?: string;
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
    status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
    sku?: string;
    barcode?: string;
    ean?: string;
    tradePrice?: number;
    rrp?: number;
    taxRate?: number;
    taxClassId?: string;
    fandom?: string;
    images?: Array<{ url: string; alt?: string; order?: number }>;
    productType?: 'SIMPLE' | 'VARIANT' | 'BUNDLED';
    variations?: Array<{
      name: string;
      options: Array<string | { value: string; price?: number; stock?: number; imageUrl?: string }>;
    }>;
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
      const attributeIds = [...new Set(data.attributes.map((a) => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of data.attributes) {
        const attribute = attributes.find((a) => a.id === attrDto.attributeId);
        if (!attribute) continue;

        if (attribute.type === 'SELECT' && attrDto.attributeValueId) {
          const valueExists = attribute.values.some((v) => v.id === attrDto.attributeValueId);
          if (!valueExists) {
            throw new BadRequestException(
              `Attribute value not found for attribute ${attribute.name}`,
            );
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

    const productType = data.productType || 'SIMPLE';
    const variationsPayload =
      data.variations && data.variations.length > 0
        ? data.variations.map((v) => ({
            name: v.name,
            options: Array.isArray(v.options)
              ? v.options.map((opt) =>
                  typeof opt === 'string'
                    ? { value: opt }
                    : {
                        value: opt.value,
                        price: opt.price,
                        stock: opt.stock,
                        imageUrl: opt.imageUrl,
                      },
                )
              : [],
          }))
        : undefined;

    // Create product
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        shortDescription: data.shortDescription,
        slug,
        price: data.price,
        currency: data.currency || 'GBP',
        stock: data.stock || 0,
        productType,
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
        taxClassId: data.taxClassId || undefined,
        fandom: data.fandom,
        images:
          data.images && data.images.length > 0
            ? {
                create: data.images.map((img, idx) => ({
                  url: img.url,
                  alt: img.alt,
                  order: img.order ?? idx,
                })),
              }
            : undefined,
        variations:
          variationsPayload && variationsPayload.length > 0
            ? {
                create: variationsPayload.map((v) => ({
                  name: v.name,
                  options: v.options as object,
                })),
              }
            : undefined,
        // New taxonomy relations
        tagsRelation:
          data.tagIds && data.tagIds.length > 0
            ? {
                create: data.tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        attributes:
          data.attributes && data.attributes.length > 0
            ? {
                create: data.attributes.map((attr) => ({
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
        variations: true,
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

    // Sync cache (fire and forget - don't block response)
    this.cacheHook.onProductCreated(product).catch((error) => {
      console.error('Failed to sync product to cache:', error);
    });

    return product;
  }

  async updateProduct(
    productId: string,
    data: {
      name?: string;
      description?: string;
      shortDescription?: string;
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
      status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
      sku?: string;
      barcode?: string;
      ean?: string;
      tradePrice?: number;
      rrp?: number;
      taxRate?: number;
      taxClassId?: string;
      fandom?: string;
      images?: Array<{ url: string; alt?: string; order?: number }>;
      productType?: 'SIMPLE' | 'VARIANT' | 'BUNDLED';
      variations?: Array<{
        name: string;
        options: Array<
          string | { value: string; price?: number; stock?: number; imageUrl?: string }
        >;
      }>;
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
      const attributeIds = [...new Set(data.attributes.map((a) => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of data.attributes) {
        const attribute = attributes.find((a) => a.id === attrDto.attributeId);
        if (!attribute) continue;

        if (attribute.type === 'SELECT' && attrDto.attributeValueId) {
          const valueExists = attribute.values.some((v) => v.id === attrDto.attributeValueId);
          if (!valueExists) {
            throw new BadRequestException(
              `Attribute value not found for attribute ${attribute.name}`,
            );
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

    // Prepare update data - only include fields that are actual Prisma Product model columns
    // Exclude fields that need special handling as relations (tagIds, images, attributes)
    // or legacy fields that shouldn't be passed directly (tags, category for non-string handling)
    const {
      tagIds: _tagIds,
      tags: _tags,
      images: _images,
      attributes: _attributes,
      ...scalarData
    } = data;

    const updateData: any = {
      ...scalarData,
      slug,
    };

    // Handle images update (replace all images)
    if (data.images !== undefined) {
      await this.prisma.productImage.deleteMany({
        where: { productId },
      });
      if (data.images && data.images.length > 0) {
        updateData.images = {
          create: data.images.map((img, idx) => ({
            url: img.url,
            alt: img.alt,
            order: img.order ?? idx,
          })),
        };
      }
    }

    // Handle tagsRelation update
    if (data.tagIds !== undefined) {
      // Delete existing tags
      await this.prisma.productTag.deleteMany({
        where: { productId },
      });
      // Create new tags
      if (data.tagIds.length > 0) {
        updateData.tagsRelation = {
          create: data.tagIds.map((tagId) => ({ tagId })),
        };
      }
    }

    // Handle variations update
    if (data.variations !== undefined) {
      await this.prisma.productVariation.deleteMany({
        where: { productId },
      });
      if (data.variations.length > 0) {
        const variationsPayload = data.variations.map((v) => ({
          name: v.name,
          options: Array.isArray(v.options)
            ? v.options.map((opt) =>
                typeof opt === 'string'
                  ? { value: opt }
                  : {
                      value: opt.value,
                      price: opt.price,
                      stock: opt.stock,
                      imageUrl: opt.imageUrl,
                    },
              )
            : [],
        }));
        await this.prisma.productVariation.createMany({
          data: variationsPayload.map((v) => ({
            productId,
            name: v.name,
            options: v.options as object,
          })),
        });
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
          create: data.attributes.map((attr) => ({
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
        variations: true,
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

    // Sync cache (fire and forget - don't block response)
    this.cacheHook.onProductUpdated(updated).catch((error) => {
      console.error('Failed to sync product update to cache:', error);
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
          variations: true,
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

  async deleteProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Product is referenced by cart_items (no onDelete cascade) - remove those first
    const orderItemCount = await this.prisma.orderItem.count({ where: { productId } });
    if (orderItemCount > 0) {
      throw new BadRequestException(
        'Product cannot be deleted because it appears in past orders. Consider setting status to Inactive instead.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } });
    });

    // Invalidate cache (fire and forget)
    this.cacheHook.onProductDeleted(productId).catch((error) => {
      console.error('Failed to invalidate product cache:', error);
    });

    return { message: 'Product deleted successfully' };
  }
}
