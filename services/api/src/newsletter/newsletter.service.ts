import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateNewsletterSubscriptionDto } from './dto/create-newsletter-subscription.dto';

@Injectable()
export class NewsletterService {
  constructor(private prisma: PrismaService) {}

  async subscribe(
    dto: CreateNewsletterSubscriptionDto,
    userId?: string,
  ): Promise<any> {
    // Check if already subscribed
    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      if (existing.status === 'subscribed') {
        throw new ConflictException('Email is already subscribed');
      }
      
      // Resubscribe if previously unsubscribed
      return this.prisma.newsletterSubscription.update({
        where: { email: dto.email },
        data: {
          status: 'subscribed',
          subscribedAt: new Date(),
          unsubscribedAt: null,
          userId: userId || existing.userId,
          source: dto.source || 'website',
        },
      });
    }

    // Create new subscription
    return this.prisma.newsletterSubscription.create({
      data: {
        email: dto.email,
        userId: userId,
        status: 'subscribed',
        source: dto.source || 'website',
        tags: dto.tags || {},
      },
    });
  }

  async unsubscribe(email: string): Promise<void> {
    const subscription = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.newsletterSubscription.update({
      where: { email },
      data: {
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
      },
    });
  }

  async getSubscriptionStatus(email: string): Promise<any> {
    const subscription = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    return {
      email,
      subscribed: subscription?.status === 'subscribed',
      status: subscription?.status || 'not_subscribed',
    };
  }

  async getAllSubscriptions(status?: string, page = 1, limit = 50): Promise<any> {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.newsletterSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { subscribedAt: 'desc' },
      }),
      this.prisma.newsletterSubscription.count({ where }),
    ]);

    return {
      data: subscriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSubscribedEmails(): Promise<string[]> {
    const subscriptions = await this.prisma.newsletterSubscription.findMany({
      where: { status: 'subscribed' },
      select: { email: true },
    });

    return subscriptions.map((s) => s.email);
  }
}

