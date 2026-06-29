import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreateNewsletterSubscriptionDto } from './dto/create-newsletter-subscription.dto';
import { SendNewsletterCampaignDto } from './dto/send-newsletter-campaign.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly templatesService: TemplatesService,
    private readonly configService: ConfigService,
  ) {}

  async subscribe(dto: CreateNewsletterSubscriptionDto, userId?: string): Promise<any> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    let subscription;
    if (existing) {
      if (existing.status === 'subscribed') {
        throw new ConflictException('Email is already subscribed');
      }
      subscription = await this.prisma.newsletterSubscription.update({
        where: { email },
        data: {
          status: 'subscribed',
          subscribedAt: new Date(),
          unsubscribedAt: null,
          userId: userId || existing.userId,
          source: dto.source || existing.source || 'website',
          tags: dto.tags ? { ...((existing.tags as object) || {}), ...dto.tags } : existing.tags,
        },
      });
    } else {
      subscription = await this.prisma.newsletterSubscription.create({
        data: {
          email,
          userId: userId ?? undefined,
          status: 'subscribed',
          source: dto.source || 'website',
          tags: dto.tags ?? undefined,
        },
      });
    }

    await this.sendSubscriptionConfirmationEmail(email);
    return subscription;
  }

  private async sendSubscriptionConfirmationEmail(email: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const unsubscribeUrl = `${frontendUrl}/shop#newsletter`;

    try {
      const rendered = await this.templatesService.render('newsletter_subscription_confirmation', {
        email,
        unsubscribeUrl,
      });
      await this.notificationsService.queueNotification(email, rendered.subject, rendered.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to queue newsletter confirmation email for ${email}: ${message}`);
    }
  }

  async unsubscribe(email: string): Promise<void> {
    const subscription = await this.prisma.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.newsletterSubscription.update({
      where: { email: email.toLowerCase().trim() },
      data: {
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
      },
    });
  }

  async getSubscriptionStatus(
    email: string,
  ): Promise<{ email: string; subscribed: boolean; status: string }> {
    const subscription = await this.prisma.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    return {
      email: email.toLowerCase().trim(),
      subscribed: subscription?.status === 'subscribed',
      status: subscription?.status || 'not_subscribed',
    };
  }

  async getAllSubscriptions(
    status?: string,
    page = 1,
    limit = 50,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: { status?: string } = {};
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

  /**
   * Queue a bulk campaign to all subscribed emails (optional JSON tags filter).
   */
  async sendCampaign(dto: SendNewsletterCampaignDto): Promise<{ queued: number }> {
    const subs = await this.prisma.newsletterSubscription.findMany({
      where: { status: 'subscribed' },
      select: { email: true, tags: true },
    });

    const filtered =
      dto.tagKey != null && dto.tagKey !== '' && dto.tagValue !== undefined
        ? subs.filter((s) => {
            const tags = (s.tags as Record<string, unknown> | null) || {};
            return tags[dto.tagKey!] === dto.tagValue;
          })
        : subs;

    let queued = 0;
    for (const { email } of filtered) {
      try {
        await this.notificationsService.queueNotification(email, dto.subject, dto.body);
        queued++;
      } catch (err: any) {
        this.logger.warn(`Newsletter campaign queue failed for ${email}: ${err?.message}`);
      }
    }

    return { queued };
  }
}
