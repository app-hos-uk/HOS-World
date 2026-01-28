import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class InfluencerStorefrontsService {
  private readonly logger = new Logger(InfluencerStorefrontsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get storefront for influencer
   */
  async findByUserId(userId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
      include: { storefront: true },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    return influencer.storefront;
  }

  /**
   * Update storefront settings
   */
  async update(userId: string, dto: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    layoutType?: string;
    showBanner?: boolean;
    showBio?: boolean;
    showSocialLinks?: boolean;
    metaTitle?: string;
    metaDescription?: string;
  }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
      include: { storefront: true },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    if (!influencer.storefront) {
      // Create storefront if it doesn't exist
      return this.prisma.influencerStorefront.create({
        data: {
          influencerId: influencer.id,
          ...dto,
        },
      });
    }

    return this.prisma.influencerStorefront.update({
      where: { id: influencer.storefront.id },
      data: dto,
    });
  }

  /**
   * Update content blocks
   */
  async updateContentBlocks(userId: string, contentBlocks: any[]) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
      include: { storefront: true },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

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
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
      include: { storefront: true },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

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

    // Get featured products
    let featuredProducts: any[] = [];
    if (influencer.storefront?.featuredProductIds.length) {
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
