import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InfluencerStorefrontsService } from '../influencer-storefronts/influencer-storefronts.service';
import { UpdateInfluencerDto, UpdateInfluencerCommissionDto, CreateProductLinkDto } from './dto/update-influencer.dto';

@Injectable()
export class InfluencersService {
  private readonly logger = new Logger(InfluencersService.name);

  constructor(
    private prisma: PrismaService,
    private storefrontsService: InfluencerStorefrontsService,
  ) {}

  // ============================================
  // INFLUENCER SELF-SERVICE
  // ============================================

  /**
   * Get influencer profile by user ID. Auto-creates profile + storefront if missing (e.g. login-only user).
   */
  async findByUserId(userId: string) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencers.service.ts:findByUserId:entry',message:'findByUserId entry',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H4'})}).catch(()=>{});
    // #endregion
    try {
      let influencer = await this.prisma.influencer.findUnique({
        where: { userId },
        include: {
          storefront: true,
          user: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencers.service.ts:findByUserId:afterFindUnique',message:'after first findUnique',data:{hasInfluencer:!!influencer},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2,H4'})}).catch(()=>{});
      // #endregion

      if (!influencer) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencers.service.ts:findByUserId:callStorefronts',message:'calling storefrontsService.findByUserId',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        await this.storefrontsService.findByUserId(userId);
        influencer = await this.prisma.influencer.findUnique({
          where: { userId },
          include: {
            storefront: true,
            user: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        });
      }

      if (!influencer) {
        throw new NotFoundException('Influencer profile not found');
      }
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencers.service.ts:findByUserId:return',message:'findByUserId returning',data:{hasInfluencer:true},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      return influencer;
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencers.service.ts:findByUserId:catch',message:'findByUserId error',data:{code:err?.code,name:err?.name,message:err?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2,H4,H5'})}).catch(()=>{});
      // #endregion
      this.logger.error(`[DEBUG] GET /influencers/me error: ${err?.code ?? 'n/a'} ${err?.name ?? 'Error'} ${err?.message ?? err}`, err?.stack);
      throw err;
    }
  }

  /**
   * Update influencer profile
   */
  async update(userId: string, dto: UpdateInfluencerDto) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      await this.storefrontsService.findByUserId(userId);
      const refetched = await this.prisma.influencer.findUnique({
        where: { userId },
      });
      if (!refetched) throw new NotFoundException('Influencer profile not found');
      return this.prisma.influencer.update({
        where: { id: refetched.id },
        data: {
          displayName: dto.displayName,
          bio: dto.bio,
          profileImage: dto.profileImage,
          bannerImage: dto.bannerImage,
          socialLinks: dto.socialLinks,
        },
        include: { storefront: true },
      });
    }

    return this.prisma.influencer.update({
      where: { id: influencer.id },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        profileImage: dto.profileImage,
        bannerImage: dto.bannerImage,
        socialLinks: dto.socialLinks,
      },
      include: {
        storefront: true,
      },
    });
  }

  /**
   * Get influencer analytics
   */
  async getAnalytics(userId: string) {
    await this.findByUserId(userId);
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
      include: {
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    // Calculate analytics
    const pendingCommission = influencer.commissions
      .filter(c => c.status === 'PENDING')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const approvedCommission = influencer.commissions
      .filter(c => c.status === 'APPROVED')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const paidCommission = influencer.commissions
      .filter(c => c.status === 'PAID')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    // Clicks/conversions by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentReferrals = influencer.referrals.filter(r => r.createdAt >= thirtyDaysAgo);
    
    const clicksByDay: Record<string, number> = {};
    const conversionsByDay: Record<string, number> = {};
    
    recentReferrals.forEach(r => {
      const dateKey = r.createdAt.toISOString().split('T')[0];
      clicksByDay[dateKey] = (clicksByDay[dateKey] || 0) + 1;
      if (r.convertedAt) {
        const convDateKey = r.convertedAt.toISOString().split('T')[0];
        conversionsByDay[convDateKey] = (conversionsByDay[convDateKey] || 0) + 1;
      }
    });

    return {
      totalClicks: influencer.totalClicks,
      totalConversions: influencer.totalConversions,
      conversionRate: influencer.totalClicks > 0 
        ? (influencer.totalConversions / influencer.totalClicks * 100).toFixed(2)
        : 0,
      totalSalesAmount: Number(influencer.totalSalesAmount),
      totalCommission: Number(influencer.totalCommission),
      pendingCommission,
      approvedCommission,
      paidCommission,
      tier: influencer.tier,
      referralCode: influencer.referralCode,
      clicksByDay: Object.entries(clicksByDay).map(([date, count]) => ({ date, count })),
      conversionsByDay: Object.entries(conversionsByDay).map(([date, count]) => ({ date, count })),
    };
  }

  /**
   * Get product links for influencer
   */
  async getProductLinks(userId: string, options?: { page?: number; limit?: number }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const { page = 1, limit = 20 } = options || {};

    const [links, total] = await Promise.all([
      this.prisma.influencerProductLink.findMany({
        where: { influencerId: influencer.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              images: { take: 1, select: { url: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerProductLink.count({
        where: { influencerId: influencer.id },
      }),
    ]);

    return {
      data: links.map(link => ({
        ...link,
        referralUrl: `/products/${link.product.slug}?ref=${influencer.referralCode}`,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create product link
   */
  async createProductLink(userId: string, dto: CreateProductLinkDto) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if link already exists
    const existingLink = await this.prisma.influencerProductLink.findUnique({
      where: {
        influencerId_productId: {
          influencerId: influencer.id,
          productId: dto.productId,
        },
      },
    });

    if (existingLink) {
      throw new ConflictException('Product link already exists');
    }

    const link = await this.prisma.influencerProductLink.create({
      data: {
        influencerId: influencer.id,
        productId: dto.productId,
        customSlug: dto.customSlug,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            images: { take: 1, select: { url: true } },
          },
        },
      },
    });

    return {
      ...link,
      referralUrl: `/products/${link.product.slug}?ref=${influencer.referralCode}`,
    };
  }

  /**
   * Delete product link
   */
  async deleteProductLink(userId: string, linkId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const link = await this.prisma.influencerProductLink.findFirst({
      where: {
        id: linkId,
        influencerId: influencer.id,
      },
    });

    if (!link) {
      throw new NotFoundException('Product link not found');
    }

    await this.prisma.influencerProductLink.delete({
      where: { id: linkId },
    });

    return { message: 'Product link deleted successfully' };
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * List all influencers (admin)
   */
  async findAll(options?: { status?: string; tier?: string; page?: number; limit?: number; search?: string }) {
    const { status, tier, page = 1, limit = 20, search } = options || {};

    const where: any = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { referralCode: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [influencers, total] = await Promise.all([
      this.prisma.influencer.findMany({
        where,
        include: {
          user: {
            select: { email: true, firstName: true, lastName: true },
          },
          _count: {
            select: { referrals: true, commissions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencer.count({ where }),
    ]);

    return {
      data: influencers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get influencer by ID (admin)
   */
  async findOne(id: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
        storefront: true,
        _count: {
          select: { referrals: true, commissions: true, productLinks: true },
        },
      },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    return influencer;
  }

  /**
   * Update influencer (admin)
   */
  async adminUpdate(id: string, dto: UpdateInfluencerDto & { status?: string; tier?: string }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    return this.prisma.influencer.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        profileImage: dto.profileImage,
        bannerImage: dto.bannerImage,
        socialLinks: dto.socialLinks,
        status: dto.status as any,
        tier: dto.tier as any,
      },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
        storefront: true,
      },
    });
  }

  /**
   * Update influencer commission config (admin)
   */
  async updateCommission(id: string, dto: UpdateInfluencerCommissionDto) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    return this.prisma.influencer.update({
      where: { id },
      data: {
        baseCommissionRate: dto.baseCommissionRate,
        categoryCommissions: dto.categoryCommissions,
        cookieDuration: dto.cookieDuration,
      },
    });
  }

  /**
   * Get influencer by slug (public)
   */
  async findBySlug(slug: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { slug },
      include: {
        storefront: true,
      },
    });

    if (!influencer || influencer.status !== 'ACTIVE') {
      throw new NotFoundException('Influencer not found');
    }

    // Don't expose sensitive data
    return {
      id: influencer.id,
      displayName: influencer.displayName,
      slug: influencer.slug,
      bio: influencer.bio,
      profileImage: influencer.profileImage,
      bannerImage: influencer.bannerImage,
      socialLinks: influencer.socialLinks,
      referralCode: influencer.referralCode,
      tier: influencer.tier,
      storefront: influencer.storefront,
    };
  }
}
