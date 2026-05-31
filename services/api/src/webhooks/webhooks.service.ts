import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly MAX_DELIVERY_ATTEMPTS = 5;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Create a new webhook
   */
  async create(createDto: CreateWebhookDto) {
    // Validate URL
    try {
      new URL(createDto.url);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }

    // Generate secret if not provided
    const secret = createDto.secret || crypto.randomBytes(32).toString('hex');

    return this.sanitizeWebhook(
      await this.prisma.webhook.create({
        data: {
          url: createDto.url,
          events: createDto.events,
          secret,
          isActive: createDto.isActive ?? true,
          sellerId: createDto.sellerId,
        },
      }),
      true,
    );
  }

  private sanitizeWebhook(webhook: any, revealSecret = false) {
    if (!webhook) return webhook;
    const { secret, ...rest } = webhook;
    return {
      ...rest,
      secret: revealSecret ? secret : undefined,
      hasSecret: !!secret,
    };
  }

  private async resolveSellerIdForUser(userId: string): Promise<string | null> {
    const seller = await this.prisma.seller.findUnique({ where: { userId }, select: { id: true } });
    return seller?.id ?? null;
  }

  async assertWebhookAccess(
    webhookId: string,
    user: { id: string; role: string },
    action: 'read' | 'write' = 'read',
  ) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    if (user.role === 'ADMIN') {
      return webhook;
    }
    const sellerId = await this.resolveSellerIdForUser(user.id);
    if (!sellerId || webhook.sellerId !== sellerId) {
      throw new ForbiddenException(`You do not have permission to ${action} this webhook`);
    }
    return webhook;
  }

  /**
   * Get all webhooks
   */
  async findAll(sellerId?: string) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        ...(sellerId ? { sellerId } : { sellerId: null }),
        isActive: true,
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return webhooks.map((w) => this.sanitizeWebhook(w));
  }

  /**
   * Get webhook by ID
   */
  async findOne(id: string, user?: { id: string; role: string }) {
    if (user) {
      await this.assertWebhookAccess(id, user, 'read');
    }

    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
          },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 deliveries
        },
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.sanitizeWebhook(webhook);
  }

  /**
   * Update webhook
   */
  async update(id: string, updateDto: Partial<CreateWebhookDto>, user?: { id: string; role: string }) {
    if (user) {
      await this.assertWebhookAccess(id, user, 'write');
    } else {
      await this.findOne(id);
    }

    const updateData: any = { ...updateDto };
    if (updateDto.events) {
      updateData.events = updateDto.events;
    }

    return this.sanitizeWebhook(
      await this.prisma.webhook.update({
        where: { id },
        data: updateData,
      }),
    );
  }

  /**
   * Delete webhook
   */
  async delete(id: string, user?: { id: string; role: string }) {
    if (user) {
      await this.assertWebhookAccess(id, user, 'write');
    } else {
      await this.findOne(id);
    }

    return this.prisma.webhook.delete({
      where: { id },
    });
  }

  /**
   * Publish event to all subscribed webhooks
   */
  async publishEvent(event: string, payload: any, sellerId?: string) {
    // Find all active webhooks subscribed to this event
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event, // Check if event is in the events array
        },
        ...(sellerId ? { sellerId } : { sellerId: null }), // Platform-wide or seller-specific
      },
    });

    if (webhooks.length === 0) {
      this.logger.debug(`No webhooks subscribed to event: ${event}`);
      return { delivered: 0, failed: 0 };
    }

    let delivered = 0;
    let failed = 0;

    // Deliver to each webhook
    for (const webhook of webhooks) {
      try {
        await this.deliverWebhook(webhook, event, payload);
        delivered++;
      } catch (error) {
        this.logger.error(`Failed to deliver webhook ${webhook.id}: ${error.message}`);
        failed++;
      }
    }

    return { delivered, failed, total: webhooks.length };
  }

  /**
   * Deliver webhook to a specific URL
   */
  private async deliverWebhook(webhook: any, event: string, payload: any) {
    // Create delivery record
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as any,
        status: 'PENDING',
        attempts: 0,
      },
    });

    try {
      // Generate signature
      const signature = this.generateSignature(JSON.stringify(payload), webhook.secret || '');

      // Make HTTP request
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Signature': signature,
          'X-Webhook-Delivery-Id': delivery.id,
          'User-Agent': 'House-of-Spells-Webhooks/1.0',
        },
        body: JSON.stringify({
          event,
          data: payload,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseText = await response.text();

      // Update delivery record
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? 'SUCCESS' : 'FAILED',
          statusCode: response.status,
          response: responseText.substring(0, 1000), // Limit response size
          attempts: { increment: 1 },
          deliveredAt: response.ok ? new Date() : null,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      return delivery;
    } catch (error: any) {
      // Update delivery record with error
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          response: error.message?.substring(0, 1000),
          attempts: { increment: 1 },
        },
      });

      throw error;
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Retry failed webhook delivery
   */
  async retryDelivery(deliveryId: string, user?: { id: string; role: string }) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhook: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    if (user) {
      await this.assertWebhookAccess(delivery.webhookId, user, 'write');
    }

    if (delivery.status === 'SUCCESS') {
      throw new BadRequestException('Delivery already succeeded');
    }

    if (delivery.attempts >= this.MAX_DELIVERY_ATTEMPTS) {
      throw new BadRequestException(
        'Maximum retry attempts reached. Use the dead letter queue retry endpoint instead.',
      );
    }

    try {
      await this.deliverWebhook(delivery.webhook, delivery.event, delivery.payload as any);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get webhook delivery history
   */
  async getDeliveryHistory(webhookId: string, limit = 50, user?: { id: string; role: string }) {
    if (user) {
      await this.assertWebhookAccess(webhookId, user, 'read');
    }

    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ==================== Dead Letter Queue ====================

  /**
   * List dead-lettered deliveries — those that exhausted all retry attempts
   */
  async listDeadLettered(limit = 50, offset = 0) {
    return this.prisma.webhookDelivery.findMany({
      where: {
        status: 'FAILED',
        attempts: { gte: this.MAX_DELIVERY_ATTEMPTS },
      },
      include: {
        webhook: {
          select: { id: true, url: true, events: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Count dead-lettered deliveries
   */
  async countDeadLettered(): Promise<number> {
    return this.prisma.webhookDelivery.count({
      where: {
        status: 'FAILED',
        attempts: { gte: this.MAX_DELIVERY_ATTEMPTS },
      },
    });
  }

  /**
   * Retry a dead-lettered delivery: reset attempts and re-deliver
   */
  async retryDeadLettered(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    if (delivery.status === 'SUCCESS') {
      throw new BadRequestException('Delivery already succeeded');
    }

    if (delivery.attempts < this.MAX_DELIVERY_ATTEMPTS) {
      throw new BadRequestException('Delivery is not in the dead letter queue');
    }

    // Reset attempts so the delivery can be retried
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { attempts: 0, status: 'PENDING' },
    });

    try {
      await this.deliverWebhook(delivery.webhook, delivery.event, delivery.payload as any);
      return { success: true, message: 'Dead-lettered delivery retried successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
