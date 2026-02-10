import {
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { NotificationPrismaService } from '../database/prisma.service';
import { CreateNewsletterSubscriptionDto } from './dto/create-newsletter-subscription.dto';

/**
 * Newsletter Service
 *
 * Handles newsletter subscriptions. Extracted from the monolith.
 * Currently the monolith marks this as NotImplemented because the
 * NewsletterSubscription model is not in the database schema yet.
 * This service mirrors that behavior for backward compatibility.
 *
 * When the newsletter model is added to this service's schema,
 * the commented code can be enabled.
 */
@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(private prisma: NotificationPrismaService) {}

  private throwNotImplemented(): never {
    throw new NotImplementedException(
      'Newsletter feature is not available. NewsletterSubscription model is not in the database schema.',
    );
  }

  async subscribe(
    dto: CreateNewsletterSubscriptionDto,
    userId?: string,
  ): Promise<any> {
    this.throwNotImplemented();
  }

  async unsubscribe(email: string): Promise<void> {
    this.throwNotImplemented();
  }

  async getSubscriptionStatus(email: string): Promise<any> {
    this.throwNotImplemented();
  }

  async getAllSubscriptions(
    status?: string,
    page = 1,
    limit = 50,
  ): Promise<any> {
    this.throwNotImplemented();
  }

  async getSubscribedEmails(): Promise<string[]> {
    this.throwNotImplemented();
  }
}
