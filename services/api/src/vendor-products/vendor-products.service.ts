import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';
import { UpdateVendorProductDto } from './dto/update-vendor-product.dto';
import { ApproveVendorProductDto, RejectVendorProductDto } from './dto/approve-vendor-product.dto';
import { QueryVendorProductsDto } from './dto/query-vendor-products.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class VendorProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sellerId: string, dto: CreateVendorProductDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');

    if (seller.vendorStatus !== 'ACTIVE' && seller.vendorStatus !== 'APPROVED') {
      throw new ForbiddenException('Your vendor account must be approved before listing products');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found in catalog');

    const existing = await this.prisma.vendorProduct.findUnique({
      where: {
        sellerId_productId: {
          sellerId: seller.id,
          productId: dto.productId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('You already have a listing for this product');
    }

    return this.prisma.vendorProduct.create({
      data: {
        sellerId: seller.id,
        productId: dto.productId,
        vendorPrice: dto.vendorPrice,
        vendorCurrency: dto.vendorCurrency || 'USD',
        costPrice: dto.costPrice,
        vendorStock: dto.vendorStock ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        allowBackorder: dto.allowBackorder ?? false,
        fulfillmentMethod: dto.fulfillmentMethod,
        leadTimeDays: dto.leadTimeDays ?? 3,
        status: 'DRAFT',
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            images: { take: 1, orderBy: { order: 'asc' } },
          },
        },
        seller: {
          select: { id: true, storeName: true, slug: true },
        },
      },
    });
  }

  async findAll(query: QueryVendorProductsDto) {
    const where: any = {};

    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.productId) where.productId = query.productId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.product = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const orderBy: any = {};
    const sortBy = query.sortBy || 'createdAt';
    orderBy[sortBy] = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.vendorProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              price: true,
              currency: true,
              status: true,
              images: { take: 1, orderBy: { order: 'asc' } },
            },
          },
          seller: {
            select: { id: true, storeName: true, slug: true },
          },
        },
      }),
      this.prisma.vendorProduct.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySeller(userId: string, query: QueryVendorProductsDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');

    return this.findAll({ ...query, sellerId: seller.id });
  }

  async findOne(id: string) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            images: { orderBy: { order: 'asc' } },
            categoryRelation: true,
            tagsRelation: { include: { tag: true } },
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            commissionRate: true,
          },
        },
      },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    return vp;
  }

  async update(id: string, userId: string, dto: UpdateVendorProductDto) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    if (vp.seller.userId !== userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    return this.prisma.vendorProduct.update({
      where: { id },
      data: {
        vendorPrice: dto.vendorPrice,
        costPrice: dto.costPrice,
        vendorStock: dto.vendorStock,
        lowStockThreshold: dto.lowStockThreshold,
        allowBackorder: dto.allowBackorder,
        fulfillmentMethod: dto.fulfillmentMethod,
        leadTimeDays: dto.leadTimeDays,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            images: { take: 1, orderBy: { order: 'asc' } },
          },
        },
      },
    });
  }

  async submitForApproval(id: string, userId: string) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    if (vp.seller.userId !== userId) {
      throw new ForbiddenException('You can only submit your own listings');
    }
    if (vp.status !== 'DRAFT' && vp.status !== 'REJECTED') {
      throw new BadRequestException('Only draft or rejected listings can be submitted');
    }

    return this.prisma.vendorProduct.update({
      where: { id },
      data: {
        status: 'PENDING_APPROVAL',
        submittedAt: new Date(),
      },
    });
  }

  async approve(id: string, adminUserId: string, dto: ApproveVendorProductDto) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
      include: { seller: true, product: true },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    if (vp.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending listings can be approved');
    }

    const platformPrice = dto.platformPrice ?? Number(vp.vendorPrice);
    const marginPercent =
      dto.marginPercent ??
      (platformPrice > 0 ? (platformPrice - Number(vp.vendorPrice)) / platformPrice : 0);

    return this.prisma.vendorProduct.update({
      where: { id },
      data: {
        status: 'APPROVED',
        platformPrice,
        marginPercent,
        approvedAt: new Date(),
        approvedBy: adminUserId,
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true },
        },
        seller: {
          select: { id: true, storeName: true },
        },
      },
    });
  }

  async reject(id: string, dto: RejectVendorProductDto) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    if (vp.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending listings can be rejected');
    }

    return this.prisma.vendorProduct.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
  }

  async activate(id: string) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    if (vp.status !== 'APPROVED' && vp.status !== 'INACTIVE') {
      throw new BadRequestException('Only approved or inactive listings can be activated');
    }
    if (vp.vendorStock <= 0) {
      throw new BadRequestException('Cannot activate listing with zero stock');
    }

    // Enforce single active vendor per product: deactivate any other ACTIVE listings
    await this.prisma.vendorProduct.updateMany({
      where: {
        productId: vp.productId,
        status: 'ACTIVE',
        id: { not: id },
      },
      data: { status: 'INACTIVE' },
    });

    return this.prisma.vendorProduct.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async deactivate(id: string, userId: string) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    if (vp.seller.userId !== userId) {
      throw new ForbiddenException('You can only deactivate your own listings');
    }

    return this.prisma.vendorProduct.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async delete(id: string, userId: string) {
    const vp = await this.prisma.vendorProduct.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!vp) throw new NotFoundException('Vendor product not found');
    if (vp.seller.userId !== userId) {
      throw new ForbiddenException('You can only delete your own listings');
    }
    if (vp.status === 'ACTIVE') {
      throw new BadRequestException('Deactivate the listing before deleting');
    }

    return this.prisma.vendorProduct.delete({ where: { id } });
  }

  async getVendorStats(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');

    const [total, active, pending, draft] = await Promise.all([
      this.prisma.vendorProduct.count({ where: { sellerId: seller.id } }),
      this.prisma.vendorProduct.count({
        where: { sellerId: seller.id, status: 'ACTIVE' },
      }),
      this.prisma.vendorProduct.count({
        where: { sellerId: seller.id, status: 'PENDING_APPROVAL' },
      }),
      this.prisma.vendorProduct.count({
        where: { sellerId: seller.id, status: 'DRAFT' },
      }),
    ]);

    return { total, active, pending, draft };
  }
}
