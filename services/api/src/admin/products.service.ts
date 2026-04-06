import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { ProductsCacheHook } from '../products/products-cache.hook';
import { MeilisearchService } from '../meilisearch/meilisearch.service';
import { slugify } from '@hos-marketplace/utils';

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private cacheHook: ProductsCacheHook,
    @Optional() private meilisearchService?: MeilisearchService,
  ) {}

  private validatePublishReadiness(
    data: {
      name?: string;
      description?: string;
      price?: number;
      images?: Array<{ url: string }>;
      categoryId?: string;
      fandom?: string;
    },
    existingProduct?: {
      name: string;
      description: string;
      price: any;
      categoryId: string | null;
      fandom: string | null;
      _count?: { images: number };
    },
  ) {
    const errors: string[] = [];

    const name = data.name ?? existingProduct?.name ?? '';
    const description = data.description ?? existingProduct?.description ?? '';
    const price = data.price ?? Number(existingProduct?.price ?? 0);
    const categoryId = data.categoryId ?? existingProduct?.categoryId ?? null;
    const fandom = data.fandom ?? existingProduct?.fandom ?? null;

    const imageCount =
      data.images !== undefined
        ? data.images.length
        : existingProduct?._count?.images ?? 0;

    if (!name || name.trim().length === 0) errors.push('Product name is required');
    if (!description || description.trim().length < 10) errors.push('Description must be at least 10 characters');
    if (!price || price <= 0) errors.push('Price must be greater than $0');
    if (imageCount === 0) errors.push('At least one product image is required');
    if (!categoryId && !fandom) errors.push('A fandom or category must be assigned');

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Product is not ready to publish. Please fix the following:',
        errors,
        statusCode: 400,
      });
    }
  }

  async createProduct(data: {
    name: string;
    description: string;
    shortDescription?: string;
    price: number;
    currency?: string;
    stock?: number;
    category?: string;
    tags?: string[];
    categoryId?: string;
    tagIds?: string[];
    attributes?: Array<{
      attributeId: string;
      attributeValueId?: string;
      textValue?: string;
      numberValue?: number;
      booleanValue?: boolean;
      dateValue?: string;
    }>;
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
    metaTitle?: string;
    metaDescription?: string;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    images?: Array<{ url: string; alt?: string; order?: number }>;
    productType?: 'SIMPLE' | 'VARIANT' | 'BUNDLED';
    variations?: Array<{
      name: string;
      options: Array<string | { value: string; price?: number; stock?: number; imageUrl?: string }>;
    }>;
  }) {
    // --- Creation-time validation (always enforced, even for DRAFT) ---
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Product name is required');
    }
    if (!data.description || data.description.trim().length < 10) {
      throw new BadRequestException('Description is required (minimum 10 characters)');
    }
    if (!data.images || data.images.length === 0) {
      throw new BadRequestException('At least one product image is required');
    }
    if (!data.categoryId && !data.fandom) {
      throw new BadRequestException('A fandom or category must be assigned');
    }

    // --- Publish-time validation (only when activating) ---
    if (data.status === 'ACTIVE') {
      this.validatePublishReadiness(data);
    }

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

    // Validate image URLs
    if (data.images && data.images.length > 0) {
      for (const img of data.images) {
        if (!img.url || typeof img.url !== 'string' || img.url.trim().length === 0) {
          throw new BadRequestException('Each image must have a non-empty URL');
        }
        try {
          new URL(img.url);
        } catch {
          throw new BadRequestException(`Invalid image URL: ${img.url}`);
        }
      }
    }

    // Block duplicate products by SKU/barcode/EAN
    const sku = data.sku?.trim();
    const barcode = data.barcode?.trim();
    const ean = data.ean?.trim();
    if (sku || barcode || ean) {
      const matchConditions: any[] = [];
      if (sku) matchConditions.push({ sku });
      if (barcode) matchConditions.push({ barcode });
      if (ean) matchConditions.push({ ean });

      const duplicate = await this.prisma.product.findFirst({
        where: {
          status: { in: ['ACTIVE', 'DRAFT'] },
          OR: matchConditions,
        },
        select: { id: true, name: true, sku: true, sellerId: true },
      });

      if (duplicate) {
        throw new BadRequestException(
          `A product with matching identifiers already exists: "${duplicate.name}" (ID: ${duplicate.id}). ` +
            `Use the Vendor Products feature to add another seller for this existing product instead of creating a duplicate.`,
        );
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
        currency: data.currency || 'USD',
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
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        weight: data.weight,
        length: data.length,
        width: data.width,
        height: data.height,
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

    if (this.meilisearchService) {
      this.meilisearchService.indexProduct(product).catch((err) => {
        this.logger.warn(`Failed to index admin product ${product.id}:`, err);
      });
    }

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
      category?: string;
      tags?: string[];
      categoryId?: string;
      tagIds?: string[];
      attributes?: Array<{
        attributeId: string;
        attributeValueId?: string;
        textValue?: string;
        numberValue?: number;
        booleanValue?: boolean;
        dateValue?: string;
      }>;
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
      metaTitle?: string;
      metaDescription?: string;
      weight?: number;
      length?: number;
      width?: number;
      height?: number;
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
      include: { _count: { select: { images: true } } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (data.status === 'ACTIVE' && product.status !== 'ACTIVE') {
      this.validatePublishReadiness(data, product as any);
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

    // Validate image URLs
    if (data.images && data.images.length > 0) {
      for (const img of data.images) {
        if (!img.url || typeof img.url !== 'string' || img.url.trim().length === 0) {
          throw new BadRequestException('Each image must have a non-empty URL');
        }
        try {
          new URL(img.url);
        } catch {
          throw new BadRequestException(`Invalid image URL: ${img.url}`);
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

    if (this.meilisearchService) {
      this.meilisearchService.indexProduct(updated).catch((err) => {
        this.logger.warn(`Failed to re-index admin product ${updated.id}:`, err);
      });
    }

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

  async getPublishReadiness(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { _count: { select: { images: true } } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const checks = [
      {
        key: 'name',
        label: 'Product name',
        passed: !!product.name && product.name.trim().length > 0,
        required: true,
      },
      {
        key: 'description',
        label: 'Product description (min 10 characters)',
        passed: !!product.description && product.description.trim().length >= 10,
        required: true,
      },
      {
        key: 'price',
        label: 'Price set (> $0)',
        passed: Number(product.price) > 0,
        required: true,
      },
      {
        key: 'images',
        label: 'At least one product image',
        passed: product._count.images > 0,
        required: true,
      },
      {
        key: 'category',
        label: 'Fandom or category assigned',
        passed: !!product.categoryId || !!product.fandom,
        required: true,
      },
      {
        key: 'metaTitle',
        label: 'SEO title',
        passed: !!product.metaTitle && product.metaTitle.trim().length > 0,
        required: false,
      },
      {
        key: 'metaDescription',
        label: 'SEO description',
        passed: !!product.metaDescription && product.metaDescription.trim().length > 0,
        required: false,
      },
      {
        key: 'sku',
        label: 'SKU assigned',
        passed: !!product.sku && product.sku.trim().length > 0,
        required: false,
      },
      {
        key: 'shortDescription',
        label: 'Short description for listings',
        passed: !!product.shortDescription && product.shortDescription.trim().length > 0,
        required: false,
      },
    ];

    const requiredPassed = checks.filter((c) => c.required).every((c) => c.passed);
    const allPassed = checks.every((c) => c.passed);

    return {
      productId,
      canPublish: requiredPassed,
      allPassed,
      checks,
    };
  }

  async findDuplicates() {
    // Find products that share SKU, barcode, or EAN with other products
    const products = await this.prisma.product.findMany({
      where: {
        status: { in: ['ACTIVE', 'DRAFT'] },
        OR: [
          { sku: { not: null } },
          { barcode: { not: null } },
          { ean: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        ean: true,
        sellerId: true,
        status: true,
        price: true,
        stock: true,
        seller: {
          select: { id: true, storeName: true, sellerType: true },
        },
        _count: { select: { orderItems: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Group by identifier matches
    const groups = new Map<string, typeof products>();
    for (const product of products) {
      const keys: string[] = [];
      if (product.sku) keys.push(`sku:${product.sku}`);
      if (product.barcode) keys.push(`barcode:${product.barcode}`);
      if (product.ean) keys.push(`ean:${product.ean}`);

      for (const key of keys) {
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(product);
      }
    }

    const duplicateGroups = Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([matchKey, items]) => ({
        matchKey,
        products: items.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          ean: p.ean,
          sellerId: p.sellerId,
          sellerName: p.seller?.storeName || 'Platform',
          sellerType: p.seller?.sellerType || 'PLATFORM',
          status: p.status,
          price: Number(p.price),
          stock: p.stock,
          orderCount: p._count.orderItems,
        })),
      }));

    return {
      totalDuplicateGroups: duplicateGroups.length,
      groups: duplicateGroups,
    };
  }

  async mergeProducts(
    canonicalProductId: string,
    duplicateProductId: string,
  ) {
    const [canonical, duplicate] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: canonicalProductId },
        include: { seller: true },
      }),
      this.prisma.product.findUnique({
        where: { id: duplicateProductId },
        include: { seller: true, vendorProducts: true },
      }),
    ]);

    if (!canonical) throw new NotFoundException('Canonical product not found');
    if (!duplicate) throw new NotFoundException('Duplicate product not found');
    if (canonicalProductId === duplicateProductId) {
      throw new BadRequestException('Cannot merge a product with itself');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create VendorProduct for the duplicate's seller on the canonical product
      if (duplicate.sellerId && duplicate.sellerId !== canonical.sellerId) {
        const existingVP = await tx.vendorProduct.findUnique({
          where: {
            sellerId_productId: {
              sellerId: duplicate.sellerId,
              productId: canonicalProductId,
            },
          },
        });

        if (!existingVP) {
          await tx.vendorProduct.create({
            data: {
              sellerId: duplicate.sellerId,
              productId: canonicalProductId,
              vendorPrice: Number(duplicate.price),
              vendorCurrency: duplicate.currency,
              costPrice: duplicate.tradePrice ? Number(duplicate.tradePrice) : null,
              vendorStock: duplicate.stock,
              lowStockThreshold: 5,
              allowBackorder: false,
              leadTimeDays: 3,
              status: 'ACTIVE',
              platformPrice: Number(duplicate.price),
              submittedAt: new Date(),
              approvedAt: new Date(),
            },
          });
        }
      }

      // Reassign order items from duplicate to canonical
      await tx.orderItem.updateMany({
        where: { productId: duplicateProductId },
        data: { productId: canonicalProductId },
      });

      // Reassign cart items from duplicate to canonical
      await tx.cartItem.updateMany({
        where: { productId: duplicateProductId },
        data: { productId: canonicalProductId },
      });

      // Move any VendorProducts that referenced the duplicate
      const duplicateVPs = await tx.vendorProduct.findMany({
        where: { productId: duplicateProductId },
      });
      for (const vp of duplicateVPs) {
        const existsOnCanonical = await tx.vendorProduct.findUnique({
          where: {
            sellerId_productId: {
              sellerId: vp.sellerId,
              productId: canonicalProductId,
            },
          },
        });
        if (!existsOnCanonical) {
          await tx.vendorProduct.update({
            where: { id: vp.id },
            data: { productId: canonicalProductId },
          });
        } else {
          await tx.vendorProduct.delete({ where: { id: vp.id } });
        }
      }

      // Aggregate stock from duplicate into canonical
      await tx.product.update({
        where: { id: canonicalProductId },
        data: {
          stock: { increment: duplicate.stock },
        },
      });

      // Soft-remove the duplicate
      await tx.product.update({
        where: { id: duplicateProductId },
        data: { status: 'INACTIVE', deletedAt: new Date() },
      });

      // Link any submissions that pointed to the duplicate
      await tx.productSubmission.updateMany({
        where: { productId: duplicateProductId },
        data: { productId: canonicalProductId },
      });

      return {
        canonicalProductId,
        duplicateProductId,
        merged: true,
        message: `Product ${duplicateProductId} merged into ${canonicalProductId}. Duplicate set to INACTIVE.`,
      };
    });
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

    this.cacheHook.onProductDeleted(productId).catch((error) => {
      console.error('Failed to invalidate product cache:', error);
    });

    if (this.meilisearchService) {
      this.meilisearchService.deleteProduct(productId).catch((err) => {
        this.logger.warn(`Failed to remove product ${productId} from MeiliSearch:`, err);
      });
    }

    return { message: 'Product deleted successfully' };
  }
}
