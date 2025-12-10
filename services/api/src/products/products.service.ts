import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { ErrorCacheService } from '../cache/error-cache.service';
import type { Product, PaginatedResponse } from '@hos-marketplace/shared-types';
import { Prisma } from '@prisma/client';
import { slugify } from '@hos-marketplace/utils';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private errorCacheService: ErrorCacheService,
  ) {}

  async create(sellerId: string, createProductDto: CreateProductDto): Promise<Product> {
    const operationKey = `product:create:${sellerId}`;
    
    return this.errorCacheService.executeWithErrorCache(
      operationKey,
      async () => this.createProduct(sellerId, createProductDto),
      { sellerId, productName: createProductDto.name },
    );
  }

  private async createProduct(sellerId: string, createProductDto: CreateProductDto): Promise<Product> {
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

    // Validate categoryId if provided
    if (createProductDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: createProductDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Validate tagIds if provided
    if (createProductDto.tagIds && createProductDto.tagIds.length > 0) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: createProductDto.tagIds } },
      });
      if (tags.length !== createProductDto.tagIds.length) {
        throw new BadRequestException('One or more tags not found');
      }
    }

    // Validate attributes if provided
    if (createProductDto.attributes && createProductDto.attributes.length > 0) {
      const attributeIds = [...new Set(createProductDto.attributes.map(a => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of createProductDto.attributes) {
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
        category: createProductDto.category, // Keep for backward compatibility
        tags: createProductDto.tags || [], // Keep for backward compatibility
        categoryId: createProductDto.categoryId, // New taxonomy field
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
        // New taxonomy relations
        tagsRelation: createProductDto.tagIds && createProductDto.tagIds.length > 0
          ? {
              create: createProductDto.tagIds.map(tagId => ({ tagId })),
            }
          : undefined,
        attributes: createProductDto.attributes && createProductDto.attributes.length > 0
          ? {
              create: createProductDto.attributes.map(attr => ({
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
        images: true,
        variations: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
        categoryRelation: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        tagsRelation: {
          include: {
            tag: true,
          },
        },
        attributes: {
          include: {
            attribute: {
              include: {
                values: true,
              },
            },
            attributeValue: true,
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
      where.category = searchDto.category; // Backward compatibility
    }

    if (searchDto.categoryId) {
      where.categoryId = searchDto.categoryId;
    }

    if (searchDto.tagIds && searchDto.tagIds.length > 0) {
      where.tagsRelation = {
        some: {
          tagId: { in: searchDto.tagIds },
        },
      };
    }

    if (searchDto.attributeFilters && searchDto.attributeFilters.length > 0) {
      where.attributes = {
        some: {
          OR: searchDto.attributeFilters.map(filter => {
            const condition: any = { attributeId: filter.attributeId };
            if (filter.value) {
              condition.OR = [
                { textValue: filter.value },
                { attributeValue: { slug: filter.value } },
              ];
            }
            if (filter.minValue !== undefined || filter.maxValue !== undefined) {
              condition.numberValue = {};
              if (filter.minValue !== undefined) {
                condition.numberValue.gte = filter.minValue;
              }
              if (filter.maxValue !== undefined) {
                condition.numberValue.lte = filter.maxValue;
              }
            }
            return condition;
          }),
        },
      };
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
          categoryRelation: {
            include: {
              parent: {
                include: {
                  parent: true,
                },
              },
            },
          },
          tagsRelation: {
            include: {
              tag: true,
            },
          },
          attributes: {
            include: {
              attribute: {
                include: {
                  values: true,
                },
              },
              attributeValue: true,
            },
          },
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
        categoryRelation: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        tagsRelation: {
          include: {
            tag: true,
          },
        },
        attributes: {
          include: {
            attribute: {
              include: {
                values: true,
              },
            },
            attributeValue: true,
          },
        },
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
        categoryRelation: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        tagsRelation: {
          include: {
            tag: true,
          },
        },
        attributes: {
          include: {
            attribute: {
              include: {
                values: true,
              },
            },
            attributeValue: true,
          },
        },
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
        categoryRelation: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        tagsRelation: {
          include: {
            tag: true,
          },
        },
        attributes: {
          include: {
            attribute: {
              include: {
                values: true,
              },
            },
            attributeValue: true,
          },
        },
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

    // Validate categoryId if provided
    if (updateProductDto.categoryId !== undefined) {
      if (updateProductDto.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: updateProductDto.categoryId },
        });
        if (!category) {
          throw new NotFoundException('Category not found');
        }
      }
    }

    // Validate tagIds if provided
    if (updateProductDto.tagIds && updateProductDto.tagIds.length > 0) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: updateProductDto.tagIds } },
      });
      if (tags.length !== updateProductDto.tagIds.length) {
        throw new BadRequestException('One or more tags not found');
      }
    }

    // Validate attributes if provided
    if (updateProductDto.attributes && updateProductDto.attributes.length > 0) {
      const attributeIds = [...new Set(updateProductDto.attributes.map(a => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of updateProductDto.attributes) {
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

    // Prepare update data
    const updateData: any = {
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
      category: updateProductDto.category, // Backward compatibility
      tags: updateProductDto.tags, // Backward compatibility
      categoryId: updateProductDto.categoryId,
      status: updateProductDto.status,
    };

    // Handle tagsRelation update
    if (updateProductDto.tagIds !== undefined) {
      // Delete existing tags
      await this.prisma.productTag.deleteMany({
        where: { productId },
      });
      // Create new tags
      if (updateProductDto.tagIds.length > 0) {
        updateData.tagsRelation = {
          create: updateProductDto.tagIds.map(tagId => ({ tagId })),
        };
      }
    }

    // Handle attributes update
    if (updateProductDto.attributes !== undefined) {
      // Delete existing attributes
      await this.prisma.productAttribute.deleteMany({
        where: { productId },
      });
      // Create new attributes
      if (updateProductDto.attributes.length > 0) {
        updateData.attributes = {
          create: updateProductDto.attributes.map(attr => ({
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

    // Update product
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: updateData,
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
        categoryRelation: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        tagsRelation: {
          include: {
            tag: true,
          },
        },
        attributes: {
          include: {
            attribute: {
              include: {
                values: true,
              },
            },
            attributeValue: true,
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
      images: product.images?.map((img: any) => ({
        id: img.id,
        url: img.url,
        alt: img.alt || undefined,
        order: img.order,
        type: img.type.toLowerCase() as any,
      })) || [],
      variations: product.variations?.map((v: any) => ({
        id: v.id,
        name: v.name,
        options: Array.isArray(v.options) ? v.options : [],
      })) || [],
      fandom: product.fandom || undefined,
      category: product.category || undefined, // Backward compatibility
      tags: product.tags || [], // Backward compatibility
      status: product.status.toLowerCase() as any,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    // Add taxonomy data if available
    if (product.categoryRelation) {
      mapped.categoryId = product.categoryRelation.id;
      mapped.categoryData = {
        id: product.categoryRelation.id,
        name: product.categoryRelation.name,
        slug: product.categoryRelation.slug,
        path: product.categoryRelation.path,
        level: product.categoryRelation.level,
        parent: product.categoryRelation.parent ? {
          id: product.categoryRelation.parent.id,
          name: product.categoryRelation.parent.name,
          slug: product.categoryRelation.parent.slug,
        } : undefined,
      };
    }

    if (product.tagsRelation && product.tagsRelation.length > 0) {
      mapped.tagIds = product.tagsRelation.map((pt: any) => pt.tagId);
      mapped.tagsData = product.tagsRelation.map((pt: any) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        slug: pt.tag.slug,
        category: pt.tag.category,
      }));
    }

    if (product.attributes && product.attributes.length > 0) {
      mapped.attributes = product.attributes.map((pa: any) => {
        const attr: any = {
          id: pa.id,
          attributeId: pa.attributeId,
          attribute: {
            id: pa.attribute.id,
            name: pa.attribute.name,
            slug: pa.attribute.slug,
            type: pa.attribute.type,
          },
        };

        // Add value based on attribute type
        if (pa.attribute.type === 'SELECT' && pa.attributeValue) {
          attr.value = {
            id: pa.attributeValue.id,
            value: pa.attributeValue.value,
            slug: pa.attributeValue.slug,
          };
        } else if (pa.attribute.type === 'TEXT' && pa.textValue) {
          attr.value = pa.textValue;
        } else if (pa.attribute.type === 'NUMBER' && pa.numberValue !== null) {
          attr.value = Number(pa.numberValue);
        } else if (pa.attribute.type === 'BOOLEAN' && pa.booleanValue !== null) {
          attr.value = pa.booleanValue;
        } else if (pa.attribute.type === 'DATE' && pa.dateValue) {
          attr.value = pa.dateValue.toISOString();
        }

        return attr;
      });
    }

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
