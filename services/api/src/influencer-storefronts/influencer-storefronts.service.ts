import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { UpdateStorefrontDto } from './dto/update-storefront.dto';

const CONTENT_BLOCK_TYPES = new Set([
  'hero',
  'featured_products',
  'text',
  'image',
  'video',
  'testimonial',
  'cta',
]);

const MAX_CONTENT_BLOCKS = 50;
const MAX_TEXT_FIELD_LENGTH = 10000;
const MAX_URL_FIELD_LENGTH = 2048;
const MAX_SHORT_FIELD_LENGTH = 512;

@Injectable()
export class InfluencerStorefrontsService {
  private readonly logger = new Logger(InfluencerStorefrontsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ensure user has an Influencer profile and storefront; create if missing (e.g. "login only" user).
   */
  private async ensureInfluencerProfile(userId: string) {
    try {
      let influencer = await this.prisma.influencer.findUnique({
        where: { userId },
        include: { storefront: true },
      });
      if (influencer) return influencer;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });
      if (!user || user.role !== 'INFLUENCER') {
        throw new NotFoundException('Influencer profile not found');
      }

      const acceptedInvitation = await this.prisma.influencerInvitation.findFirst({
        where: { email: user.email.toLowerCase(), status: 'ACCEPTED' },
      });

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
          status: acceptedInvitation ? 'ACTIVE' : 'INACTIVE',
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
      this.logger.error(
        `[DEBUG] ensureInfluencerProfile error: ${err?.code ?? 'n/a'} ${err?.name ?? 'Error'} ${err?.message ?? err}`,
        err?.stack,
      );
      if (
        err?.code === 'P2021' ||
        (err?.message && String(err.message).includes('does not exist'))
      ) {
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
      const ex = await this.prisma.influencer
        .findUnique({ where: { referralCode: code } })
        .catch(() => null);
      if (!ex) return code;
    }
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private async uniqueSlug(displayName: string): Promise<string> {
    const slug =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'influencer';
    for (let i = 0; i < 20; i++) {
      const s = i === 0 ? slug : `${slug}-${i}`;
      const ex = await this.prisma.influencer.findUnique({ where: { slug: s } }).catch(() => null);
      if (!ex) return s;
    }
    return `${slug}-${randomBytes(3).toString('hex')}`;
  }

  private validateContentBlocks(contentBlocks: unknown): unknown[] {
    if (!Array.isArray(contentBlocks)) {
      throw new BadRequestException('contentBlocks must be an array');
    }
    if (contentBlocks.length > MAX_CONTENT_BLOCKS) {
      throw new BadRequestException(`contentBlocks cannot exceed ${MAX_CONTENT_BLOCKS} items`);
    }

    const urlFields = new Set(['url', 'imageUrl', 'videoUrl', 'href', 'src', 'link']);
    const shortFields = new Set(['title', 'subtitle', 'label', 'buttonText', 'author', 'name']);

    for (let i = 0; i < contentBlocks.length; i++) {
      const block = contentBlocks[i];
      if (!block || typeof block !== 'object' || Array.isArray(block)) {
        throw new BadRequestException(`contentBlocks[${i}] must be an object`);
      }
      const { type, data } = block as { type?: unknown; data?: unknown };
      if (typeof type !== 'string' || !CONTENT_BLOCK_TYPES.has(type)) {
        throw new BadRequestException(
          `contentBlocks[${i}].type must be one of: ${[...CONTENT_BLOCK_TYPES].join(', ')}`,
        );
      }
      if (data != null) {
        if (typeof data !== 'object' || Array.isArray(data)) {
          throw new BadRequestException(`contentBlocks[${i}].data must be an object`);
        }
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
          if (typeof value === 'string') {
            const maxLen = urlFields.has(key)
              ? MAX_URL_FIELD_LENGTH
              : shortFields.has(key)
                ? MAX_SHORT_FIELD_LENGTH
                : MAX_TEXT_FIELD_LENGTH;
            if (value.length > maxLen) {
              throw new BadRequestException(
                `contentBlocks[${i}].data.${key} exceeds maximum length of ${maxLen}`,
              );
            }
          }
        }
      }
    }

    return contentBlocks;
  }

  private toPublicStorefront(storefront: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    layoutType: string;
    showBanner: boolean;
    showBio: boolean;
    showSocialLinks: boolean;
    contentBlocks: unknown;
    featuredProductIds: string[];
    metaTitle: string | null;
    metaDescription: string | null;
  }) {
    return {
      primaryColor: storefront.primaryColor,
      secondaryColor: storefront.secondaryColor,
      backgroundColor: storefront.backgroundColor,
      textColor: storefront.textColor,
      fontFamily: storefront.fontFamily,
      layoutType: storefront.layoutType,
      showBanner: storefront.showBanner,
      showBio: storefront.showBio,
      showSocialLinks: storefront.showSocialLinks,
      contentBlocks: storefront.contentBlocks,
      featuredProductIds: storefront.featuredProductIds,
      metaTitle: storefront.metaTitle,
      metaDescription: storefront.metaDescription,
    };
  }

  /**
   * Get storefront for influencer
   */
  async findByUserId(userId: string) {
    const influencer = await this.ensureInfluencerProfile(userId);
    if (influencer.storefront) return influencer.storefront;
    return this.prisma.influencerStorefront.create({
      data: { influencerId: influencer.id },
    });
  }

  /** Allowed storefront update fields (whitelist to avoid Prisma "Unknown arg" from extra body keys) */
  private static STOREFRONT_UPDATE_KEYS = [
    'primaryColor',
    'secondaryColor',
    'backgroundColor',
    'textColor',
    'fontFamily',
    'layoutType',
    'showBanner',
    'showBio',
    'showSocialLinks',
    'metaTitle',
    'metaDescription',
  ] as const;

  /**
   * Update storefront settings
   */
  async update(userId: string, dto: UpdateStorefrontDto) {
    const data: Record<string, unknown> = {};
    for (const key of InfluencerStorefrontsService.STOREFRONT_UPDATE_KEYS) {
      if (dto[key as keyof UpdateStorefrontDto] !== undefined) {
        data[key] = dto[key as keyof UpdateStorefrontDto];
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
  async updateContentBlocks(userId: string, contentBlocks: unknown[]) {
    const validated = this.validateContentBlocks(contentBlocks);
    const influencer = await this.ensureInfluencerProfile(userId);

    if (!influencer.storefront) {
      return this.prisma.influencerStorefront.create({
        data: {
          influencerId: influencer.id,
          contentBlocks: validated as Prisma.InputJsonValue,
        },
      });
    }

    return this.prisma.influencerStorefront.update({
      where: { id: influencer.storefront.id },
      data: { contentBlocks: validated as Prisma.InputJsonValue },
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

    const validIds = products.map((p) => p.id);

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

    let featuredProducts: {
      id: string;
      name: string;
      slug: string;
      price: unknown;
      images: { url: string; alt: string | null }[];
    }[] = [];

    const featuredIds = influencer.storefront?.featuredProductIds ?? [];
    if (featuredIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: featuredIds },
          status: 'ACTIVE',
          stock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: { take: 1, select: { url: true, alt: true } },
        },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      featuredProducts = featuredIds
        .filter((id) => byId.has(id))
        .map((id) => byId.get(id)!);
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
      storefront: influencer.storefront
        ? this.toPublicStorefront(influencer.storefront)
        : null,
      featuredProducts,
    };
  }
}
