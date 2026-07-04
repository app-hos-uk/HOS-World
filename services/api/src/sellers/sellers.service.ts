import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellerType, LogisticsOption, Prisma } from '@prisma/client';
import { slugify } from '@hos-marketplace/utils';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);
  private readonly encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    @Optional() private activityService?: ActivityService,
    @Optional() @Inject(NotificationsService) private notificationsService?: NotificationsService,
  ) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        throw new Error(
          'ENCRYPTION_KEY must be set in production/staging for seller field encryption',
        );
      }
      this.logger.warn('ENCRYPTION_KEY not set — seller encryption uses a random ephemeral key (dev only)');
    }
    this.encryptionKey = key || require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Ensures the seller account is approved/active before marketplace write operations.
   */
  async assertSellerCanOperate(userId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    if (seller.vendorStatus !== 'ACTIVE' && seller.vendorStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Your vendor account must be approved before performing this action',
      );
    }
    return seller;
  }

  private encryptField(value: string): string {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, salt, 32);
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: gcm:<salt>:<iv>:<authTag>:<ciphertext>
    return `gcm:${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decryptField(encrypted: string): string {
    try {
      const crypto = require('crypto');
      if (encrypted.startsWith('gcm:')) {
        const parts = encrypted.split(':');
        if (parts.length !== 5) return encrypted;
        const [, saltHex, ivHex, authTagHex, encData] = parts;
        const salt = Buffer.from(saltHex, 'hex');
        const key = crypto.scryptSync(this.encryptionKey, salt, 32);
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(encData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
      // Legacy CBC format: <iv>:<ciphertext> (backward compatible)
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

  /**
   * Transparently re-encrypts legacy CBC-encrypted fields to GCM on read.
   * Call after loading a seller to migrate in-place without downtime.
   */
  private async migrateEncryptionIfNeeded(sellerId: string, fields: { accountNumberEnc?: string | null; sortCodeEnc?: string | null }) {
    const updates: Record<string, string> = {};
    if (fields.accountNumberEnc && !fields.accountNumberEnc.startsWith('gcm:')) {
      const plaintext = this.decryptField(fields.accountNumberEnc);
      if (plaintext !== fields.accountNumberEnc) {
        updates.accountNumberEnc = this.encryptField(plaintext);
      }
    }
    if (fields.sortCodeEnc && !fields.sortCodeEnc.startsWith('gcm:')) {
      const plaintext = this.decryptField(fields.sortCodeEnc);
      if (plaintext !== fields.sortCodeEnc) {
        updates.sortCodeEnc = this.encryptField(plaintext);
      }
    }
    if (Object.keys(updates).length > 0) {
      await this.prisma.seller.update({ where: { id: sellerId }, data: updates }).catch((err) => {
        this.logger.warn(`Encryption migration failed for seller ${sellerId}: ${err?.message}`);
      });
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
      take: 200,
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

    // Transparently migrate legacy CBC-encrypted fields to GCM
    this.migrateEncryptionIfNeeded(seller.id, {
      accountNumberEnc: seller.accountNumberEnc,
      sortCodeEnc: seller.sortCodeEnc,
    }).catch(() => {});

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
      where: { vendorStatus: 'ACTIVE' },
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
    const publicSellerSelect = {
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
      subDomain: true,
      customDomain: true,
      vendorStatus: true,
      deletedAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
      _count: {
        select: {
          products: {
            where: { status: 'ACTIVE' },
          },
        },
      },
    } satisfies Prisma.SellerSelect;

    // First try exact slug match
    let seller = await this.prisma.seller.findUnique({
      where: { slug },
      select: publicSellerSelect,
    });

    // Fallback: try matching by subDomain field (subdomain may differ from slug
    // due to DNS-safe character stripping, e.g. slug "my_store" → subDomain "my-store")
    if (!seller) {
      seller = await this.prisma.seller.findFirst({
        where: { subDomain: slug },
        select: publicSellerSelect,
      });
    }

    if (!seller || seller.vendorStatus !== 'ACTIVE' || seller.deletedAt) {
      throw new NotFoundException('Seller not found');
    }

    const theme = await this.resolvePublicSellerTheme(seller.id);

    return {
      id: seller.id,
      storeName: seller.storeName,
      slug: seller.slug,
      description: seller.description,
      logo: seller.logo,
      country: seller.country,
      city: seller.city,
      region: seller.region,
      rating: seller.rating,
      totalSales: seller.totalSales,
      sellerType: seller.sellerType,
      verified: seller.verified,
      createdAt: seller.createdAt,
      subDomain: seller.subDomain,
      customDomain: seller.customDomain,
      user: seller.user ?? undefined,
      _count: seller._count,
      theme,
    };
  }

  private async resolvePublicSellerTheme(sellerId: string) {
    const publicThemeSelect = {
      name: true,
      type: true,
      config: true,
      assets: true,
      previewImages: true,
      versionString: true,
      description: true,
    } satisfies Prisma.ThemeSelect;

    const themeSettings = await this.prisma.sellerThemeSettings.findUnique({
      where: { sellerId },
      select: {
        customLogoUrl: true,
        customFaviconUrl: true,
        customColors: true,
        theme: { select: publicThemeSelect },
      },
    });

    if (!themeSettings) {
      const defaultTheme = await this.prisma.theme.findFirst({
        where: { type: 'HOS', isActive: true },
        select: publicThemeSelect,
      });

      if (!defaultTheme) {
        return null;
      }

      return {
        theme: this.mapPublicTheme(defaultTheme),
        customSettings: null,
      };
    }

    return {
      theme: themeSettings.theme ? this.mapPublicTheme(themeSettings.theme) : null,
      customSettings: {
        customLogoUrl: themeSettings.customLogoUrl,
        customFaviconUrl: themeSettings.customFaviconUrl,
        customColors: themeSettings.customColors,
      },
    };
  }

  private mapPublicTheme(theme: {
    name: string;
    type: string;
    config: Prisma.JsonValue;
    assets: Prisma.JsonValue | null;
    previewImages: string[];
    versionString: string | null;
    description: string | null;
  }) {
    const typeStr = typeof theme.type === 'string' ? theme.type : String(theme.type ?? '');
    return {
      name: theme.name,
      type: typeStr.toLowerCase(),
      config: theme.config,
      assets: theme.assets ?? undefined,
      previewImages: Array.isArray(theme.previewImages) ? theme.previewImages : [],
      description: theme.description ?? undefined,
      versionString: theme.versionString ?? undefined,
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
    const { BCRYPT_PASSWORD_ROUNDS } = await import('../config/bcrypt-cost');
    const hashedPassword = await bcrypt.hash(applicationData.password, BCRYPT_PASSWORD_ROUNDS);

    const baseSlug = slugify(applicationData.storeName);
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.seller.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    try {
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
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('An account with this email already exists.');
      }
      throw error;
    }
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

  async submitVerificationDocument(
    userId: string,
    data: { documentType: string; fileUrl: string; fileName?: string },
  ) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');

    if (!data.documentType?.trim()) throw new BadRequestException('Document type is required');
    if (!data.fileUrl?.trim()) throw new BadRequestException('File URL is required');

    const existingPending = await this.prisma.sellerVerificationDocument.findFirst({
      where: { sellerId: seller.id, documentType: data.documentType, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException(
        `A ${data.documentType} document is already pending review. Please wait for the review to complete before resubmitting.`,
      );
    }

    const doc = await this.prisma.sellerVerificationDocument.create({
      data: {
        sellerId: seller.id,
        documentType: data.documentType,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        status: 'PENDING',
      },
    });

    this.activityService?.createLog({
      userId,
      sellerId: seller.id,
      action: 'VERIFICATION_SUBMITTED',
      entityType: 'SellerVerificationDocument',
      entityId: doc.id,
      description: `Verification document "${data.documentType}" submitted for review`,
      metadata: { documentType: data.documentType },
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    this.notificationsService?.sendNotificationToUser(
      userId,
      'GENERAL',
      'Verification document submitted',
      `Your ${data.documentType} document has been submitted for review. You will be notified once the review is complete.`,
      { documentId: doc.id },
    ).catch((e) => this.logger.warn(`Notification failed: ${(e as Error).message}`));

    return doc;
  }

  async listVerificationDocuments(userId: string, role: string) {
    if (role === 'ADMIN' || role === 'FINANCE') {
      return this.prisma.sellerVerificationDocument.findMany({
        include: {
          seller: { select: { id: true, storeName: true, vendorStatus: true, sellerType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    }
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundException('Seller profile not found');
    return this.prisma.sellerVerificationDocument.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewVerificationDocument(
    documentId: string,
    reviewerId: string,
    data: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string },
  ) {
    const doc = await this.prisma.sellerVerificationDocument.findUnique({
      where: { id: documentId },
      include: { seller: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const updated = await this.prisma.sellerVerificationDocument.update({
      where: { id: documentId },
      data: {
        status: data.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes,
      },
    });

    if (data.status === 'APPROVED') {
      const approvedCount = await this.prisma.sellerVerificationDocument.count({
        where: { sellerId: doc.sellerId, status: 'APPROVED' },
      });
      if (approvedCount >= 1) {
        await this.prisma.seller.update({
          where: { id: doc.sellerId },
          data: { vendorStatus: 'APPROVED', verified: true, approvedAt: new Date(), approvedBy: reviewerId },
        });
      }
    }

    if (data.status === 'REJECTED') {
      const remainingPendingOrApproved = await this.prisma.sellerVerificationDocument.count({
        where: {
          sellerId: doc.sellerId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      if (remainingPendingOrApproved === 0) {
        await this.prisma.seller.update({
          where: { id: doc.sellerId },
          data: { vendorStatus: 'REJECTED', verified: false },
        });
      }
    }

    this.activityService?.createLog({
      userId: reviewerId,
      sellerId: doc.sellerId,
      action: data.status === 'APPROVED' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      entityType: 'SellerVerificationDocument',
      entityId: documentId,
      description: `Verification document "${doc.documentType}" ${data.status.toLowerCase()}${data.reviewNotes ? `: ${data.reviewNotes}` : ''}`,
      metadata: { status: data.status, documentType: doc.documentType },
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    if (doc.seller?.userId) {
      const title = data.status === 'APPROVED' ? 'Verification approved' : 'Verification rejected';
      const message = data.status === 'APPROVED'
        ? `Your ${doc.documentType} document has been approved. Your account is now verified.`
        : `Your ${doc.documentType} document was rejected.${data.reviewNotes ? ` Reason: ${data.reviewNotes}` : ' Please resubmit with a valid document.'}`;
      this.notificationsService?.sendNotificationToUser(
        doc.seller.userId,
        'GENERAL',
        title,
        message,
        { documentId, status: data.status },
      ).catch((e) => this.logger.warn(`Notification failed: ${(e as Error).message}`));
    }

    return updated;
  }
}
