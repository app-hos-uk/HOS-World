import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellerType, LogisticsOption } from '@prisma/client';
import { slugify } from '@hos-marketplace/utils';

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);
  private readonly encryptionKey: string;

  constructor(private prisma: PrismaService) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key && process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    this.encryptionKey = key || 'hos-default-key-change-in-production';
  }

  private encryptField(value: string): string {
    const crypto = require('crypto');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptField(encrypted: string): string {
    try {
      const crypto = require('crypto');
      const [ivHex, encData] = encrypted.split(':');
      if (!ivHex || !encData) return encrypted;
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encrypted;
    }
  }

  async findMyProducts(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    const products = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { order: 'asc' }, take: 1 },
      },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      price: Number(p.price),
      stock: p.stock,
      images: p.images?.map((i) => i.url) ?? [],
      createdAt: p.createdAt.toISOString(),
      category: p.category ?? undefined,
      fandom: p.fandom ?? undefined,
    }));
  }

  async findOne(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return {
      ...seller,
      accountNumberLast4: seller.accountNumberEnc
        ? this.decryptField(seller.accountNumberEnc).slice(-4)
        : null,
      sortCodeLast4: seller.sortCodeEnc ? this.decryptField(seller.sortCodeEnc).slice(-4) : null,
      accountNumberEnc: undefined,
      sortCodeEnc: undefined,
    };
  }

  async findAllPublic(limit = 200) {
    const sellers = await this.prisma.seller.findMany({
      take: Math.min(limit, 500),
      select: {
        id: true,
        storeName: true,
        slug: true,
        description: true,
        logo: true,
        country: true,
        city: true,
        region: true,
        rating: true,
        totalSales: true,
        sellerType: true,
        verified: true,
        createdAt: true,
        user: {
          select: {
            avatar: true,
          },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sellers;
  }

  async findBySlug(slug: string) {
    // First try exact slug match
    let seller = await this.prisma.seller.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    // Fallback: try matching by subDomain field (subdomain may differ from slug
    // due to DNS-safe character stripping, e.g. slug "my_store" → subDomain "my-store")
    if (!seller) {
      seller = await this.prisma.seller.findFirst({
        where: { subDomain: slug },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              avatar: true,
            },
          },
          _count: {
            select: { products: true },
          },
        },
      });
    }

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Return public-safe seller data (strip sensitive/internal fields)
    const {
      accountNumberEnc: _enc,
      sortCodeEnc: _sc,
      userId: _uid,
      stripeConnectAccountId: _stripe,
      commissionRate: _cr,
      ...publicSeller
    } = seller as any;
    return {
      ...publicSeller,
      user: publicSeller.user
        ? {
            firstName: publicSeller.user.firstName,
            lastName: publicSeller.user.lastName,
            avatar: publicSeller.user.avatar,
            role: publicSeller.user.role,
          }
        : undefined,
    };
  }

  async update(userId: string, updateSellerDto: UpdateSellerDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    // Build update data, excluding nested objects and sensitive fields that need special handling
    const { warehouseAddress: _wh, accountNumber, sortCode, ...restDto } = updateSellerDto;
    const updateData: any = { ...restDto };

    if (accountNumber) {
      updateData.accountNumberEnc = this.encryptField(accountNumber);
    }
    if (sortCode) {
      updateData.sortCodeEnc = this.encryptField(sortCode);
    }

    // If updating slug (via storeName), ensure uniqueness
    if (updateSellerDto.storeName && updateSellerDto.storeName !== seller.storeName) {
      const baseSlug = slugify(updateSellerDto.storeName);
      let slug = baseSlug;
      let counter = 1;

      while (await this.prisma.seller.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      updateData.slug = slug;
    }

    const updated = await this.prisma.seller.update({
      where: { userId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
          },
        },
      },
    });

    return {
      ...updated,
      accountNumberLast4: updated.accountNumberEnc
        ? this.decryptField(updated.accountNumberEnc).slice(-4)
        : null,
      sortCodeLast4: updated.sortCodeEnc ? this.decryptField(updated.sortCodeEnc).slice(-4) : null,
      accountNumberEnc: undefined,
      sortCodeEnc: undefined,
    };
  }

  async updateSellerType(userId: string, sellerType: SellerType) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.prisma.seller.update({
      where: { userId },
      data: { sellerType },
    });
  }

  async updateLogisticsOption(userId: string, logisticsOption: LogisticsOption) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.prisma.seller.update({
      where: { userId },
      data: { logisticsOption },
    });
  }

  async updateDomain(
    userId: string,
    customDomain?: string,
    subDomain?: string,
    domainPackagePurchased?: boolean,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    return this.prisma.seller.update({
      where: { userId },
      data: {
        customDomain,
        subDomain,
        domainPackagePurchased,
      },
    });
  }

  /**
   * Public vendor application — creates a user with SELLER role and a seller
   * profile with PENDING vendorStatus. Marketing/Admin must approve.
   */
  async applyAsVendor(applicationData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    storeName: string;
    description?: string;
    country?: string;
    city?: string;
    legalBusinessName?: string;
    companyName?: string;
    vatNumber?: string;
    taxId?: string;
    applicationNotes?: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: applicationData.email },
      include: { sellerProfile: true },
    });

    // Allow re-application if previous application was rejected
    if (existingUser) {
      if (existingUser.sellerProfile?.vendorStatus === 'REJECTED') {
        const updated = await this.prisma.seller.update({
          where: { userId: existingUser.id },
          data: {
            vendorStatus: 'PENDING',
            storeName: applicationData.storeName,
            description: applicationData.description,
            applicationNotes: applicationData.applicationNotes,
          },
        });
        return {
          userId: existingUser.id,
          sellerId: updated.id,
          storeName: updated.storeName,
          slug: updated.slug,
          vendorStatus: updated.vendorStatus,
          message: 'Vendor re-application submitted. Your application is under review.',
        };
      }
      throw new BadRequestException('Unable to process this application. Please contact support.');
    }

    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(applicationData.password, 10);

    const baseSlug = slugify(applicationData.storeName);
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.seller.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: applicationData.email,
          password: hashedPassword,
          firstName: applicationData.firstName,
          lastName: applicationData.lastName,
          role: 'SELLER',
          country: applicationData.country,
        },
      });

      const seller = await tx.seller.create({
        data: {
          userId: user.id,
          storeName: applicationData.storeName,
          slug,
          description: applicationData.description,
          country: applicationData.country,
          city: applicationData.city,
          legalBusinessName: applicationData.legalBusinessName,
          companyName: applicationData.companyName,
          vatNumber: applicationData.vatNumber,
          taxId: applicationData.taxId,
          applicationNotes: applicationData.applicationNotes,
          vendorStatus: 'PENDING',
        },
      });

      return {
        userId: user.id,
        sellerId: seller.id,
        storeName: seller.storeName,
        slug: seller.slug,
        vendorStatus: seller.vendorStatus,
        message: 'Vendor application submitted. Your application is under review.',
      };
    });

    return result;
  }

  // === Vendor Management Methods ===

  async findAllVendors(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = params;
    const where: any = {};

    if (status) where.vendorStatus = status;
    if (search) {
      where.OR = [
        { storeName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { legalBusinessName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [vendors, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { products: true, orders: true, vendorProducts: true },
          },
        },
      }),
      this.prisma.seller.count({ where }),
    ]);

    return {
      data: vendors.map(
        ({ accountNumberEnc: _a, sortCodeEnc: _s, stripeConnectAccountId: _sid, ...rest }) => rest,
      ),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveVendor(sellerId: string, adminUserId: string, notes?: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    if (seller.vendorStatus !== 'PENDING') {
      throw new BadRequestException(`Cannot approve vendor with status ${seller.vendorStatus}`);
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        vendorStatus: 'APPROVED',
        verified: true,
        approvedAt: new Date(),
        approvedBy: adminUserId,
        applicationNotes: notes,
      },
    });

    this.logger.log(`Vendor ${sellerId} approved by admin ${adminUserId}`);
    return updated;
  }

  async rejectVendor(sellerId: string, reason: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    if (seller.vendorStatus !== 'PENDING') {
      throw new BadRequestException(`Cannot reject vendor with status ${seller.vendorStatus}`);
    }

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        vendorStatus: 'REJECTED',
        applicationNotes: reason,
      },
    });
  }

  async suspendVendor(sellerId: string, reason: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        vendorStatus: 'SUSPENDED',
        applicationNotes: reason,
      },
    });
  }

  async activateVendor(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    if (seller.vendorStatus !== 'APPROVED' && seller.vendorStatus !== 'SUSPENDED') {
      throw new BadRequestException('Vendor must be approved or suspended to activate');
    }

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { vendorStatus: 'ACTIVE' },
    });
  }

  async updateCommissionRate(sellerId: string, rate: number) {
    if (rate < 0 || rate > 1) {
      throw new BadRequestException('Commission rate must be between 0 and 1');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { commissionRate: rate },
    });
  }

  async updateSubscription(sellerId: string, plan: string, fee: number, expiresAt?: Date) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found');

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        subscriptionPlan: plan,
        monthlySubscriptionFee: fee,
        subscriptionExpiresAt: expiresAt,
      },
    });
  }

  async getVendorDashboardStats(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');

    const [totalOrders, pendingOrders, totalProducts, activeProducts, pendingListings] =
      await Promise.all([
        this.prisma.order.count({ where: { sellerId: seller.id } }),
        this.prisma.order.count({
          where: { sellerId: seller.id, status: 'PENDING' },
        }),
        this.prisma.product.count({ where: { sellerId: seller.id } }),
        this.prisma.product.count({
          where: { sellerId: seller.id, status: 'ACTIVE' },
        }),
        this.prisma.vendorProduct.count({
          where: { sellerId: seller.id, status: 'PENDING_APPROVAL' },
        }),
      ]);

    return {
      vendorStatus: seller.vendorStatus,
      commissionRate: Number(seller.commissionRate),
      stripeConnectOnboarded: seller.stripeConnectOnboarded,
      totalOrders,
      pendingOrders,
      totalProducts,
      activeProducts,
      pendingListings,
      totalSales: seller.totalSales,
    };
  }
}
