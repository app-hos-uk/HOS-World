import {
  Injectable,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class InfluencerStorefrontsService {
  private readonly logger = new Logger(InfluencerStorefrontsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ensure user has an Influencer profile and storefront; create if missing (e.g. "login only" user).
   */
  private async ensureInfluencerProfile(userId: string) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencer-storefronts.service.ts:ensureInfluencerProfile:entry',message:'ensureInfluencerProfile entry',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2,H5'})}).catch(()=>{});
    // #endregion
    try {
      let influencer = await this.prisma.influencer.findUnique({
        where: { userId },
        include: { storefront: true },
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencer-storefronts.service.ts:ensureInfluencerProfile:afterFindUnique',message:'after findUnique',data:{hasInfluencer:!!influencer},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (influencer) return influencer;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });
      if (!user || user.role !== 'INFLUENCER') {
        throw new NotFoundException('Influencer profile not found');
      }
      const displayName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
      const slug = await this.uniqueSlug(displayName);
      const referralCode = await this.uniqueReferralCode(displayName);
      influencer = await this.prisma.influencer.create({
        data: {
          userId: user.id,
          displayName,
          slug,
          referralCode,
          status: 'ACTIVE',
        },
        include: { storefront: true },
      });
      await this.prisma.influencerStorefront.create({
        data: { influencerId: influencer.id },
      });
      const refreshed = await this.prisma.influencer.findUnique({
        where: { id: influencer.id },
        include: { storefront: true },
      });
      if (!refreshed?.storefront) throw new NotFoundException('Influencer profile not found');
      return refreshed;
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencer-storefronts.service.ts:ensureInfluencerProfile:catch',message:'ensureInfluencerProfile error',data:{code:err?.code,name:err?.name,message:err?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H5'})}).catch(()=>{});
      // #endregion
      this.logger.error(`[DEBUG] ensureInfluencerProfile error: ${err?.code ?? 'n/a'} ${err?.name ?? 'Error'} ${err?.message ?? err}`, err?.stack);
      if (err?.code === 'P2021' || (err?.message && String(err.message).includes('does not exist'))) {
        this.logger.warn('Influencer tables missing; run migrations.', err?.message);
        throw new ServiceUnavailableException(
          'Influencer features are not available yet. Database migration may be pending.',
        );
      }
      throw err;
    }
  }

  private async uniqueReferralCode(prefix: string): Promise<string> {
    const base = (prefix.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'INF').slice(0, 6);
    for (let i = 0; i < 20; i++) {
      const code = base + randomBytes(2).toString('hex').toUpperCase();
      const ex = await this.prisma.influencer.findUnique({ where: { referralCode: code } }).catch(() => null);
      if (!ex) return code;
    }
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private async uniqueSlug(displayName: string): Promise<string> {
    let slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'influencer';
    for (let i = 0; i < 20; i++) {
      const s = i === 0 ? slug : `${slug}-${i}`;
      const ex = await this.prisma.influencer.findUnique({ where: { slug: s } }).catch(() => null);
      if (!ex) return s;
    }
    return `${slug}-${randomBytes(3).toString('hex')}`;
  }

  /**
   * Get storefront for influencer
   */
  async findByUserId(userId: string) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencer-storefronts.service.ts:findByUserId:entry',message:'findByUserId storefront entry',data:{userId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const influencer = await this.ensureInfluencerProfile(userId);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/25f24f4e-a9b4-48c0-a492-7ec1e970ba34',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'influencer-storefronts.service.ts:findByUserId:afterEnsure',message:'after ensureInfluencerProfile',data:{hasStorefront:!!influencer.storefront},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    if (influencer.storefront) return influencer.storefront;
    return this.prisma.influencerStorefront.create({
      data: { influencerId: influencer.id },
    });
  }

  /** Allowed storefront update fields (whitelist to avoid Prisma "Unknown arg" from extra body keys) */
  private static STOREFRONT_UPDATE_KEYS = [
    'primaryColor', 'secondaryColor', 'backgroundColor', 'textColor', 'fontFamily',
    'layoutType', 'showBanner', 'showBio', 'showSocialLinks', 'metaTitle', 'metaDescription',
  ] as const;

  /**
   * Update storefront settings
   */
  async update(userId: string, dto: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const key of InfluencerStorefrontsService.STOREFRONT_UPDATE_KEYS) {
      if (dto[key] !== undefined && dto[key] !== null) {
        data[key] = dto[key];
      }
    }

    const influencer = await this.ensureInfluencerProfile(userId);

    if (!influencer.storefront) {
      return this.prisma.influencerStorefront.create({
        data: {
          influencerId: influencer.id,
          ...data,
        } as any,
      });
    }

    return this.prisma.influencerStorefront.update({
      where: { id: influencer.storefront.id },
      data: data as any,
    });
  }

  /**
   * Update content blocks
   */
  async updateContentBlocks(userId: string, contentBlocks: any[]) {
    const influencer = await this.ensureInfluencerProfile(userId);

    if (!influencer.storefront) {
      return this.prisma.influencerStorefront.create({
        data: {
          influencerId: influencer.id,
          contentBlocks,
        },
      });
    }

    return this.prisma.influencerStorefront.update({
      where: { id: influencer.storefront.id },
      data: { contentBlocks },
    });
  }

  /**
   * Update featured products
   */
  async updateFeaturedProducts(userId: string, productIds: string[]) {
    const influencer = await this.ensureInfluencerProfile(userId);

    // Validate product IDs exist
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    const validIds = products.map(p => p.id);

    if (!influencer.storefront) {
      return this.prisma.influencerStorefront.create({
        data: {
          influencerId: influencer.id,
          featuredProductIds: validIds,
        },
      });
    }

    return this.prisma.influencerStorefront.update({
      where: { id: influencer.storefront.id },
      data: { featuredProductIds: validIds },
    });
  }

  /**
   * Get public storefront data with products
   */
  async getPublicStorefront(slug: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { slug },
      include: { storefront: true },
    });

    if (!influencer || influencer.status !== 'ACTIVE') {
      throw new NotFoundException('Storefront not found');
    }

    // Get featured products (or fallback to recent ACTIVE products when none set)
    let featuredProducts: any[] = [];
    if (influencer.storefront?.featuredProductIds?.length) {
      featuredProducts = await this.prisma.product.findMany({
        where: {
          id: { in: influencer.storefront.featuredProductIds },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: { take: 1, select: { url: true, alt: true } },
        },
      });
    }
    if (featuredProducts.length === 0) {
      featuredProducts = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: { take: 1, select: { url: true, alt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      });
    }

    return {
      influencer: {
        displayName: influencer.displayName,
        slug: influencer.slug,
        bio: influencer.bio,
        profileImage: influencer.profileImage,
        bannerImage: influencer.bannerImage,
        socialLinks: influencer.socialLinks,
        referralCode: influencer.referralCode,
      },
      storefront: influencer.storefront,
      featuredProducts,
    };
  }
}
