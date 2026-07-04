import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import type { Product, PaginatedResponse } from '@hos-marketplace/shared-types';
import { Prisma, ProductStatus, ImageType } from '@prisma/client';
import { slugify } from '@hos-marketplace/utils';
import { ProductsCacheHook } from './products-cache.hook';
import { MeilisearchService } from '../meilisearch/meilisearch.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private cacheHook: ProductsCacheHook,
    @Optional() private meilisearchService?: MeilisearchService,
  ) {}

  private vendorTableChecked = false;
  private vendorTableExistsFlag = false;

  private async checkVendorTableExists(): Promise<boolean> {
    if (this.vendorTableChecked) return this.vendorTableExistsFlag;
    try {
      const result: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT 1 AS exists FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_products' LIMIT 1`,
      );
      this.vendorTableExistsFlag = result.length > 0;
    } catch {
      this.vendorTableExistsFlag = false;
    }
    this.vendorTableChecked = true;
    return this.vendorTableExistsFlag;
  }

  /**
   * Invalidate product cache. If productId is given, clears that specific
   * product entry AND the list caches; otherwise clears only list caches.
   */
  async invalidateProductCache(productId?: string): Promise<void> {
    if (productId) {
      await this.cacheHook.onProductDeleted(productId);
    } else {
      await this.cacheHook.onListCacheInvalidated();
    }
  }

  async create(sellerId: string, createProductDto: CreateProductDto): Promise<Product> {
    // Check if user is admin - they may not have a seller profile
    const user = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { role: true },
    });

    let seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller && user?.role === 'ADMIN') {
      // Auto-create a seller profile for admin users so they can create products
      seller = await this.prisma.seller.create({
        data: {
          userId: sellerId,
          storeName: 'House of Spells',
          slug: `admin-store-${sellerId.substring(0, 8)}`,
          sellerType: 'B2C_SELLER',
          country: 'United States',
          verified: true,
        },
      });
    }

    if (!seller) {
      throw new NotFoundException(
        'Seller profile not found. Please set up your seller profile first.',
      );
    }

    if (
      createProductDto.price != null &&
      (typeof createProductDto.price !== 'number' || createProductDto.price < 0)
    ) {
      throw new BadRequestException('Price must be a non-negative number');
    }
    if (
      createProductDto.stock != null &&
      (typeof createProductDto.stock !== 'number' || createProductDto.stock < 0)
    ) {
      throw new BadRequestException('Stock cannot be negative');
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
      const attributeIds = [...new Set(createProductDto.attributes.map((a) => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of createProductDto.attributes) {
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

    // Create product
    const product = await this.prisma.product.create({
      data: {
        sellerId: seller.id,
        name: createProductDto.name,
        description: createProductDto.description,
        shortDescription: createProductDto.shortDescription,
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
        status: (createProductDto.status as ProductStatus) || ProductStatus.DRAFT,
        productType: createProductDto.productType || 'SIMPLE',
        parentProductId: createProductDto.parentProductId, // For variant products
        images:
          createProductDto.images && createProductDto.images.length > 0
            ? {
                create: createProductDto.images.map((img, index) => ({
                  url: img.url,
                  alt: img.alt,
                  order: img.order ?? index,
                  type: (img.type as ImageType) || ImageType.IMAGE,
                })),
              }
            : undefined,
        variations: createProductDto.variations
          ? {
              create: createProductDto.variations.map((variation) => ({
                name: variation.name,
                options: variation.options as any,
              })),
            }
          : undefined,
        // New taxonomy relations
        tagsRelation:
          createProductDto.tagIds && createProductDto.tagIds.length > 0
            ? {
                create: createProductDto.tagIds.map((tagId) => ({ tagId })),
              }
            : undefined,
        attributes:
          createProductDto.attributes && createProductDto.attributes.length > 0
            ? {
                create: createProductDto.attributes.map((attr) => ({
                  attributeId: attr.attributeId,
                  attributeValueId: attr.attributeValueId,
                  textValue: attr.value || attr.textValue,
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

    const mappedProduct = this.mapToProductType(product, false, false, false);

    // Sync cache (fire and forget - don't block response)
    this.cacheHook.onProductCreated(product).catch((error) => {
      console.error('Failed to sync product to cache:', error);
    });

    // Index in MeiliSearch
    if (this.meilisearchService) {
      this.meilisearchService.indexProduct(product).catch((err) => {
        this.logger.warn(`Failed to index product ${product.id} in MeiliSearch:`, err);
      });
    }

    return mappedProduct;
  }

  async findAll(searchDto: SearchProductsDto): Promise<PaginatedResponse<Product>> {
    const page = searchDto.page || 1;
    const limit = Math.min(searchDto.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Public browsing always shows ACTIVE only; status override requires admin context (isAdmin flag).
    // Without an explicit admin flag the query param is ignored for security.
    const requestedStatus = searchDto.status?.toUpperCase();
    const effectiveStatus =
      searchDto.isAdmin && requestedStatus
        ? (requestedStatus as ProductStatus)
        : ProductStatus.ACTIVE;
    const where: Prisma.ProductWhereInput = {
      status: effectiveStatus,
    };

    // Listing eligibility: when browsing publicly (status=ACTIVE), only show products that
    // either have an active VendorProduct with stock + price, or are platform-owned (no vendor mapping).
    // Wrapped in vendorTableExists check to gracefully degrade if vendor_products table
    // hasn't been created yet (migration pending).
    if (effectiveStatus === ProductStatus.ACTIVE) {
      const vendorTableExists = await this.checkVendorTableExists();
      if (vendorTableExists) {
        if (!where.AND) where.AND = [];
        (where.AND as Prisma.ProductWhereInput[]).push({
          OR: [
            { vendorProducts: { none: {} }, stock: { gt: 0 }, price: { gt: 0 } },
            {
              vendorProducts: {
                some: {
                  status: 'ACTIVE',
                  vendorStock: { gt: 0 },
                  vendorPrice: { gt: 0 },
                },
              },
            },
          ],
        });
      } else {
        if (!where.AND) where.AND = [];
        (where.AND as Prisma.ProductWhereInput[]).push({
          stock: { gt: 0 },
          price: { gt: 0 },
        });
      }
    }

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
          OR: searchDto.attributeFilters.map((filter) => {
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
      // Accept either the owner's userId (legacy callers) or the Seller.id
      // (public storefront, which no longer exposes userId).
      const seller = await this.prisma.seller.findFirst({
        where: {
          OR: [{ userId: searchDto.sellerId }, { id: searchDto.sellerId }],
        },
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
        // Sort by popularity: reviewCount (desc), then averageRating (desc), then createdAt (desc)
        // This prioritizes products with more reviews and higher ratings
        // Note: Prisma supports multiple orderBy fields, prioritizing reviewCount first
        orderBy = { reviewCount: 'desc' } as Prisma.ProductOrderByWithRelationInput;
        // For more complex sorting, we'd need to fetch and sort in memory or use raw SQL
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
            take: 3,
          },
          variations: true,
          categoryRelation: {
            select: { id: true, name: true, slug: true, parentId: true },
          },
          tagsRelation: {
            include: { tag: { select: { id: true, name: true, slug: true } } },
          },
          attributes: {
            include: {
              attribute: { select: { id: true, name: true } },
              attributeValue: { select: { id: true, value: true } },
            },
          },
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

  async findOne(
    id: string,
    includeSeller: boolean = false,
    includeBundles: boolean = false,
  ): Promise<Product> {
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
        ...(includeBundles
          ? {
              bundleItems: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      images: {
                        take: 1,
                        orderBy: { order: 'asc' },
                      },
                    },
                  },
                },
                orderBy: { order: 'asc' },
              },
            }
          : {}),
        ...(includeSeller
          ? {
              seller: {
                select: {
                  id: true,
                  storeName: true,
                  slug: true,
                },
              },
            }
          : {}),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Public (unauthenticated) context: only return ACTIVE products
    if ((product as any).status !== 'ACTIVE' && !includeSeller && !includeBundles) {
      throw new NotFoundException('Product not found');
    }

    return this.mapToProductType(product, includeSeller, includeBundles);
  }

  async findBySlug(
    sellerSlug: string,
    productSlug: string,
    includeSeller: boolean = false,
  ): Promise<Product> {
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
        ...(includeSeller
          ? {
              seller: {
                select: {
                  id: true,
                  storeName: true,
                  slug: true,
                },
              },
            }
          : {}),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapToProductType(product, includeSeller);
  }

  async findBySlugOnly(slug: string, includeSeller: boolean = false, requireActive: boolean = true): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { slug, ...(requireActive ? { status: 'ACTIVE' as any } : {}) },
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
        ...(includeSeller
          ? {
              seller: {
                select: {
                  id: true,
                  storeName: true,
                  slug: true,
                },
              },
            }
          : {}),
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

    if (
      updateProductDto.price != null &&
      (typeof updateProductDto.price !== 'number' || updateProductDto.price < 0)
    ) {
      throw new BadRequestException('Price must be a non-negative number');
    }
    if (
      updateProductDto.stock != null &&
      (typeof updateProductDto.stock !== 'number' || updateProductDto.stock < 0)
    ) {
      throw new BadRequestException('Stock cannot be negative');
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
      const attributeIds = [...new Set(updateProductDto.attributes.map((a) => a.attributeId))];
      const attributes = await this.prisma.attribute.findMany({
        where: { id: { in: attributeIds } },
        include: { values: true },
      });
      if (attributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes not found');
      }

      // Validate attribute values for SELECT type
      for (const attrDto of updateProductDto.attributes) {
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

    // Prepare update data
    const updateData: any = {
      name: updateProductDto.name,
      description: updateProductDto.description,
      shortDescription: updateProductDto.shortDescription,
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
          create: updateProductDto.tagIds.map((tagId) => ({ tagId })),
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
          create: updateProductDto.attributes.map((attr) => ({
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

    const mappedProduct = this.mapToProductType(updated, false, false, false);

    this.cacheHook.onProductUpdated(updated).catch((error) => {
      console.error('Failed to sync product update to cache:', error);
    });

    if (this.meilisearchService) {
      this.meilisearchService.indexProduct(updated).catch((err) => {
        this.logger.warn(`Failed to re-index product ${updated.id} in MeiliSearch:`, err);
      });
    }

    return mappedProduct;
  }

  async bulkUpdate(
    sellerUserId: string,
    productIds: string[],
    updates: { status?: ProductStatus; stock?: number; priceAdjustmentPercent?: number },
  ): Promise<{ updated: number; failed: number; errors: string[] }> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerUserId },
    });

    if (!seller) {
      throw new BadRequestException('Seller not found');
    }

    if (!productIds.length) {
      throw new BadRequestException('No products selected');
    }

    if (
      updates.stock != null &&
      (typeof updates.stock !== 'number' || updates.stock < 0)
    ) {
      throw new BadRequestException('Stock cannot be negative');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, sellerId: seller.id },
      select: { id: true, price: true },
    });

    if (products.length !== productIds.length) {
      throw new ForbiddenException('One or more products not found or not owned by you');
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const data: Prisma.ProductUpdateInput = {};
        if (updates.status) data.status = updates.status;
        if (updates.stock != null) data.stock = updates.stock;
        if (updates.priceAdjustmentPercent != null) {
          const current = Number(product.price);
          const adjusted = current * (1 + updates.priceAdjustmentPercent / 100);
          data.price = Math.max(0, Math.round(adjusted * 100) / 100);
        }

        if (Object.keys(data).length === 0) {
          continue;
        }

        const updatedProduct = await this.prisma.product.update({
          where: { id: product.id },
          data,
          include: {
            images: { orderBy: { order: 'asc' } },
            variations: true,
            seller: { select: { id: true, storeName: true, slug: true } },
            categoryRelation: { include: { parent: { include: { parent: true } } } },
            tagsRelation: { include: { tag: true } },
            attributes: {
              include: {
                attribute: { include: { values: true } },
                attributeValue: true,
              },
            },
          },
        });

        this.cacheHook.onProductUpdated(updatedProduct).catch((error) => {
          console.error('Failed to sync product update to cache:', error);
        });
        if (this.meilisearchService) {
          this.meilisearchService.indexProduct(updatedProduct).catch((err) => {
            this.logger.warn(`Failed to re-index product ${updatedProduct.id}:`, err);
          });
        }
        updated++;
      } catch (error: any) {
        failed++;
        errors.push(`Product ${product.id}: ${error.message}`);
      }
    }

    return { updated, failed, errors };
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

    this.cacheHook.onProductDeleted(productId).catch((error) => {
      console.error('Failed to invalidate product cache:', error);
    });

    if (this.meilisearchService) {
      this.meilisearchService.deleteProduct(productId).catch((err) => {
        this.logger.warn(`Failed to remove product ${productId} from MeiliSearch:`, err);
      });
    }
  }

  async trackProductView(productId: string, data: {
    userId?: string;
    sessionId?: string;
    ipHash?: string;
    userAgent?: string;
    referrer?: string;
  }) {
    try {
      await this.prisma.$transaction([
        this.prisma.productView.create({
          data: { productId, ...data },
        }),
        this.prisma.product.update({
          where: { id: productId },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
    } catch (e) {
      this.logger.warn(`Failed to track product view: ${(e as Error).message}`);
    }
  }

  private mapToProductType(
    product: any,
    includeSeller: boolean = false,
    includeBundles: boolean = false,
    isPublicContext: boolean = true,
  ): Product {
    const mapped: any = {
      id: product.id,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription ?? undefined,
      slug: product.slug,
      sku: product.sku || undefined,
      barcode: product.barcode || undefined,
      ean: product.ean || undefined,
      price: Number(product.price),
      tradePrice: isPublicContext ? undefined : (product.tradePrice ? Number(product.tradePrice) : undefined),
      rrp: isPublicContext ? undefined : (product.rrp ? Number(product.rrp) : undefined),
      currency: product.currency,
      taxRate: Number(product.taxRate),
      stock: product.stock,
      productType: product.productType || 'SIMPLE',
      parentProductId: product.parentProductId || undefined,
      images:
        product.images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          alt: img.alt || undefined,
          order: img.order,
          type: img.type as ImageType,
        })) || [],
      variations:
        product.variations?.map((v: any) => ({
          id: v.id,
          name: v.name,
          options: this.normalizeVariationOptions(v.options),
        })) || [],
      fandom: product.fandom || undefined,
      category: product.category || undefined, // Backward compatibility
      tags: product.tags || [], // Backward compatibility
      status: product.status as ProductStatus,
      averageRating: product.averageRating ?? 0,
      reviewCount: product.reviewCount ?? 0,
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
        parent: product.categoryRelation.parent
          ? {
              id: product.categoryRelation.parent.id,
              name: product.categoryRelation.parent.name,
              slug: product.categoryRelation.parent.slug,
            }
          : undefined,
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

    // Include bundle items if requested
    if (includeBundles && product.bundleItems && product.bundleItems.length > 0) {
      mapped.bundleItems = product.bundleItems.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        product: {
          id: item.product.id,
          name: item.product.name,
          price: Number(item.product.price),
          imageUrl: item.product.images?.[0]?.url || null,
        },
        quantity: item.quantity,
        priceOverride: item.priceOverride ? Number(item.priceOverride) : undefined,
        isRequired: item.isRequired,
        order: item.order,
      }));
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

  /**
   * Create a bundle product
   */
  async createBundle(sellerId: string, createBundleDto: CreateBundleDto): Promise<Product> {
    // Verify seller exists
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Validate bundle items
    if (!createBundleDto.items || createBundleDto.items.length === 0) {
      throw new BadRequestException('Bundle must contain at least one product');
    }

    // Verify all products exist and belong to the same seller (or are platform-owned)
    const productIds = createBundleDto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        OR: [{ sellerId: seller.id }, { isPlatformOwned: true }],
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or not accessible');
    }

    // Generate slug
    const baseSlug = slugify(createBundleDto.name);
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

    // Calculate bundle stock (minimum of all items)
    const bundleStock = createBundleDto.stock || Math.min(...products.map((p) => p.stock || 0));

    // Create bundle product
    const bundle = await this.prisma.product.create({
      data: {
        sellerId: seller.id,
        name: createBundleDto.name,
        description: createBundleDto.description,
        slug,
        sku: createBundleDto.sku,
        price: createBundleDto.price,
        currency: products[0]?.currency || 'USD',
        stock: bundleStock,
        categoryId: createBundleDto.categoryId,
        productType: 'BUNDLED',
        status: 'DRAFT',
        bundleItems: {
          create: createBundleDto.items.map((item, index) => ({
            productId: item.productId,
            quantity: item.quantity,
            priceOverride: item.priceOverride,
            isRequired: item.isRequired ?? true,
            order: item.order ?? index,
          })),
        },
      },
      include: {
        bundleItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: {
                  take: 1,
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    // Invalidate cache for bundle
    await this.cacheHook.onProductCreated(bundle.id);

    return this.mapToProductType(bundle, false, true, false);
  }

  /** Normalize variation options stored as array, object map, or JSON string */
  private normalizeVariationOptions(options: unknown): unknown[] {
    if (options == null) return [];
    if (Array.isArray(options)) return options;
    if (typeof options === 'object') {
      return Object.values(options as Record<string, unknown>);
    }
    if (typeof options === 'string') {
      const trimmed = options.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          return this.normalizeVariationOptions(JSON.parse(trimmed));
        } catch {
          /* fall through */
        }
      }
      return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
    }
    return [];
  }
}
