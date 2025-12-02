import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class PersonalizationService {
  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {}

  async getPersonalizedProducts(userId: string, limit: number = 10): Promise<any[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // Get user preferences
    const preferences = user.aiPreferences || {};
    const favoriteFandoms = user.favoriteFandoms || [];

    // Get AI recommendations
    const recommendations = await this.geminiService.generateRecommendations(
      userId,
      favoriteFandoms,
      [], // Could add recent products
      preferences,
    );

    // Search products based on AI recommendations
    const products = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { fandom: { in: favoriteFandoms } },
          { category: { in: recommendations } },
          { tags: { hasSome: recommendations } },
        ],
      },
      take: limit,
      include: {
        images: {
          take: 1,
        },
        seller: {
          select: {
            storeName: true,
            slug: true,
          },
        },
      },
      orderBy: {
        averageRating: 'desc',
      },
    });

    return products;
  }

  async updateUserPreferences(userId: string, behavior: any): Promise<void> {
    const analysis = await this.geminiService.analyzeUserBehavior(
      userId,
      behavior.browsing || [],
      behavior.purchases || [],
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        aiPreferences: analysis,
      },
    });
  }

  async getPersonalizedContent(userId: string, contentType: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return '';
    }

    return this.geminiService.generatePersonalizedContent(
      {
        favoriteFandoms: user.favoriteFandoms || [],
        preferences: user.aiPreferences || {},
      },
      contentType as any,
    );
  }
}

