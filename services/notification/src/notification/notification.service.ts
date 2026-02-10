import { Injectable, Logger } from '@nestjs/common';
import { NotificationPrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import {
  orderConfirmationTemplate,
  orderShippedTemplate,
  orderDeliveredTemplate,
  sellerInvitationTemplate,
  genericNotificationTemplate,
} from '../email/templates';

/**
 * Notification Service
 *
 * Handles creation, retrieval, and sending of notifications.
 * This mirrors the monolith's NotificationsService but is now standalone.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: NotificationPrismaService,
    private emailService: EmailService,
  ) {}

  // ─── Notification CRUD ──────────────────────────────────────────────────────

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  // ─── Send Notification to a User ────────────────────────────────────────────

  async sendNotificationToUser(
    userId: string,
    type: string,
    subject: string,
    content: string,
    email?: string,
    metadata?: any,
  ): Promise<void> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type: type as any,
          subject,
          content,
          email,
          status: 'SENT',
          sentAt: new Date(),
          metadata: metadata ? (metadata as any) : undefined,
        },
      });

      if (email) {
        const html = genericNotificationTemplate(subject, content);
        await this.emailService.sendEmail(email, subject, html);
      }

      this.logger.log(
        `Notification sent to user ${userId}: ${type} - ${subject}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send notification to user ${userId}: ${error?.message}`,
      );
    }
  }

  // ─── Order-related Notifications ────────────────────────────────────────────

  async sendOrderConfirmation(data: {
    orderId: string;
    orderNumber: string;
    userId: string;
    userEmail: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
  }): Promise<void> {
    const subject = `Order Confirmation - ${data.orderNumber}`;
    const html = orderConfirmationTemplate(
      data.orderNumber,
      data.items,
      data.total,
    );

    let emailSent = false;

    if (data.userEmail && data.userEmail.trim().length > 0) {
      emailSent = await this.emailService.sendEmail(
        data.userEmail,
        subject,
        html,
      );
    } else {
      this.logger.warn(
        `No email address provided for order confirmation ${data.orderNumber} – skipping email`,
      );
    }

    const status = emailSent ? 'SENT' : 'PENDING';

    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: 'ORDER_CONFIRMATION',
        subject,
        content: `Your order ${data.orderNumber} has been confirmed.`,
        email: data.userEmail || null,
        status,
        sentAt: emailSent ? new Date() : null,
        metadata: { orderId: data.orderId } as any,
      },
    });

    this.logger.log(
      `Order confirmation for ${data.orderNumber}: email ${emailSent ? 'sent to ' + data.userEmail : 'not sent (status: ' + status + ')'}`,
    );
  }

  async sendOrderShipped(data: {
    orderId: string;
    orderNumber: string;
    userId: string;
    userEmail: string;
    trackingCode: string;
  }): Promise<void> {
    const subject = `Your Order Has Shipped - ${data.orderNumber}`;
    const html = orderShippedTemplate(data.orderNumber, data.trackingCode);

    await this.emailService.sendEmail(data.userEmail, subject, html);

    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: 'ORDER_SHIPPED',
        subject,
        content: `Your order ${data.orderNumber} has been shipped. Tracking: ${data.trackingCode}`,
        email: data.userEmail,
        status: 'SENT',
        sentAt: new Date(),
        metadata: {
          orderId: data.orderId,
          trackingCode: data.trackingCode,
        } as any,
      },
    });

    this.logger.log(
      `Order shipped notification sent for ${data.orderNumber}`,
    );
  }

  async sendOrderDelivered(data: {
    orderId: string;
    orderNumber: string;
    userId: string;
    userEmail: string;
  }): Promise<void> {
    const subject = `Order Delivered - ${data.orderNumber}`;
    const html = orderDeliveredTemplate(data.orderNumber);

    await this.emailService.sendEmail(data.userEmail, subject, html);

    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: 'ORDER_DELIVERED',
        subject,
        content: `Your order ${data.orderNumber} has been delivered.`,
        email: data.userEmail,
        status: 'SENT',
        sentAt: new Date(),
        metadata: { orderId: data.orderId } as any,
      },
    });

    this.logger.log(
      `Order delivered notification sent for ${data.orderNumber}`,
    );
  }

  // ─── Seller Invitation ──────────────────────────────────────────────────────

  async sendSellerInvitation(
    email: string,
    data: {
      sellerType: 'WHOLESALER' | 'B2C_SELLER';
      invitationLink: string;
      message?: string;
    },
  ): Promise<void> {
    const sellerTypeName =
      data.sellerType === 'WHOLESALER' ? 'Wholesaler' : 'B2C Seller';
    const subject = `You've been invited to join House of Spells as a ${sellerTypeName}`;
    const html = sellerInvitationTemplate(
      sellerTypeName,
      data.invitationLink,
      data.message,
    );

    await this.emailService.sendEmail(email, subject, html);
    this.logger.log(`Seller invitation sent to ${email} (${sellerTypeName})`);
  }
}
