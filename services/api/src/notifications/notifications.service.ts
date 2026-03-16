import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { QueueService, JobType } from '../queue/queue.service';
import { TemplatesService } from '../templates/templates.service';
import * as nodemailer from 'nodemailer';

const VALID_NOTIFICATION_TYPES = new Set([
  'ORDER_CONFIRMATION',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'ORDER_REFUNDED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'SUBMISSION_RESUBMITTED',
  'SUBMISSION_APPROVED',
  'SUBMISSION_REJECTED',
  'PRODUCT_APPROVED',
  'PRODUCT_REJECTED',
  'SETTLEMENT_COMPLETED',
  'SYSTEM',
  'GENERAL',
]);

@Injectable()
export class NotificationsService implements OnModuleInit {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(NotificationsService.name);
  private emailEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private queueService: QueueService,
    private templatesService: TemplatesService,
  ) {
    this.initializeEmailTransporter();
  }

  onModuleInit() {
    this.queueService.registerProcessor(JobType.EMAIL_NOTIFICATION, async (job) => {
      const { to, subject, html, notificationId } = job.data;
      const sent = await this.sendEmail(to, subject, html);

      if (notificationId) {
        try {
          await this.prisma.notification.update({
            where: { id: notificationId },
            data: {
              status: sent ? ('SENT' as any) : ('FAILED' as any),
              sentAt: sent ? new Date() : undefined,
            },
          });
        } catch (e) {
          this.logger.warn(`Could not update notification ${notificationId}: ${(e as Error)?.message}`);
        }
      }
    });
    this.logger.log('Registered EMAIL_NOTIFICATION processor with BullMQ');
  }

  async queueNotification(to: string, subject: string, html: string, notificationId?: string): Promise<void> {
    await this.queueService.addJob(JobType.EMAIL_NOTIFICATION, { to, subject, html, notificationId });
  }

  private initializeEmailTransporter() {
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpPort = this.configService.get('SMTP_PORT', 587);
    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPass = this.configService.get('SMTP_PASS');
    const smtpFrom = this.configService.get('SMTP_FROM', 'noreply@hos-marketplace.com');

    if (smtpHost && smtpUser && smtpPass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort.toString()),
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          from: smtpFrom,
        });

        this.emailEnabled = true;
        this.logger.log('✅ Email transporter initialized successfully');
      } catch (error: any) {
        this.logger.warn(`⚠️ Email transporter initialization failed: ${error?.message}`);
        this.logger.warn('Email notifications will be logged only');
        this.emailEnabled = false;
      }
    } else {
      this.logger.warn('⚠️ Email configuration missing - email notifications disabled');
      this.logger.warn('Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email');
      this.emailEnabled = false;
    }
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.emailEnabled || !this.transporter) {
      this.logger.debug(`📧 Email would be sent to ${to}: ${subject} (email disabled)`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM', 'noreply@hos-marketplace.com'),
        to,
        subject,
        html,
      });
      this.logger.log(`✅ Email sent to ${to}: ${subject}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Failed to send email to ${to}: ${error?.message}`);
      return false;
    }
  }

  async sendSellerInvitation(
    email: string,
    data: {
      sellerType: 'WHOLESALER' | 'B2C_SELLER';
      invitationLink: string;
      message?: string;
    },
  ): Promise<void> {
    const sellerTypeName = data.sellerType === 'WHOLESALER' ? 'Wholesaler' : 'B2C Seller';

    const rendered = await this.templatesService.render('seller_invitation', {
      sellerTypeName,
      invitationLink: data.invitationLink,
      personalMessage: data.message ? `<p>${data.message}</p>` : '',
    });

    await this.queueNotification(email, rendered.subject, rendered.body);
    this.logger.log(`Seller invitation queued for ${email} (${sellerTypeName})`);
  }

  async sendOrderConfirmation(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return;
    }

    const customerName = [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || 'Customer';

    const itemsTable = `<table><thead><tr><th>Product</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>${order.items.map((item: any) => `<tr><td>${item.product.name}</td><td>${item.quantity}</td><td>$${Number(item.price).toFixed(2)}</td><td>$${(Number(item.price) * item.quantity).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;

    const rendered = await this.templatesService.render('order_confirmation', {
      orderNumber: order.orderNumber,
      customerName,
      itemsTable,
      orderTotal: Number(order.total).toFixed(2),
      currency: '$',
    });

    const notification = await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_CONFIRMATION',
        subject: rendered.subject,
        content: `Your order ${order.orderNumber} has been confirmed.`,
        email: order.user.email,
        status: 'PENDING' as any,
      },
    });

    await this.queueNotification(order.user.email, rendered.subject, rendered.body, notification.id);
  }

  async sendOrderShipped(orderId: string, trackingCode: string, carrier = 'USPS'): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    if (!order) {
      return;
    }

    const customerName = [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || 'Customer';

    const rendered = await this.templatesService.render('order_shipped', {
      orderNumber: order.orderNumber,
      customerName,
      trackingCode,
      carrier,
    });

    const notification = await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_SHIPPED',
        subject: rendered.subject,
        content: `Your order ${order.orderNumber} has been shipped. Tracking: ${trackingCode}`,
        email: order.user.email,
        status: 'PENDING' as any,
      },
    });

    await this.queueNotification(order.user.email, rendered.subject, rendered.body, notification.id);
  }

  async sendOrderDelivered(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    if (!order) {
      return;
    }

    const customerName = [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || 'Customer';

    const rendered = await this.templatesService.render('order_delivered', {
      orderNumber: order.orderNumber,
      customerName,
    });

    const notification = await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_DELIVERED',
        subject: rendered.subject,
        content: `Your order ${order.orderNumber} has been delivered.`,
        email: order.user.email,
        status: 'PENDING' as any,
      },
    });

    await this.queueNotification(order.user.email, rendered.subject, rendered.body, notification.id);
  }

  async getUserNotifications(
    userId: string,
    options?: { limit?: number; page?: number },
  ): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number } }> {
    const limit = Math.min(options?.limit || 50, 100);
    const page = options?.page || 1;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return { data: notifications, pagination: { page, limit, total } };
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<any> {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date(), status: 'READ' as any },
    });
  }

  async markAllNotificationsRead(userId: string): Promise<any> {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date(), status: 'READ' as any },
    });
  }

  async deleteNotification(userId: string, notificationId: string): Promise<any> {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  /**
   * Get failed notifications (admin) – paginated
   */
  async getFailedNotifications(
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number } }> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { status: 'FAILED' as any },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip,
      }),
      this.prisma.notification.count({ where: { status: 'FAILED' as any } }),
    ]);

    return { data, pagination: { page: safePage, limit: safeLimit, total } };
  }

  /**
   * Retry a failed notification (admin) – re-queue and reset status to PENDING
   */
  async retryFailedNotification(id: string): Promise<any> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, status: 'FAILED' as any },
    });

    if (!notification) {
      throw new NotFoundException(`Failed notification not found: ${id}`);
    }

    const to = notification.email;
    if (!to) {
      throw new Error(`Notification ${id} has no email address`);
    }

    const subject = notification.subject || 'Notification';
    const html = await this.templatesService.render('generic_notification', {
      subject,
      bodyContent: (notification.content || '').replace(/\n/g, '<br>'),
    });

    await this.prisma.notification.update({
      where: { id },
      data: { status: 'PENDING' as any },
    });

    await this.queueNotification(to, subject, html.body, id);

    this.logger.log(`Retried failed notification ${id} for ${to}`);

    return this.prisma.notification.findUnique({ where: { id } });
  }

  /**
   * Send notification to all users with a specific role
   */
  async sendNotificationToRole(
    role: string,
    type: string,
    subject: string,
    content: string,
    metadata?: any,
  ): Promise<void> {
    if (!VALID_NOTIFICATION_TYPES.has(type)) {
      this.logger.warn(`Invalid notification type: ${type}`);
      throw new Error(`Invalid notification type: ${type}`);
    }

    try {
      const users = await this.prisma.user.findMany({
        where: { role: role as any },
        select: { id: true, email: true },
      });

      if (users.length === 0) {
        this.logger.warn(`No users found with role: ${role}`);
        return;
      }

      const notifications = users.map((user) => ({
        userId: user.id,
        type: type as any,
        subject,
        content,
        email: user.email,
        status: 'PENDING' as const,
        metadata: metadata ? (metadata as any) : undefined,
      }));

      await this.prisma.notification.createMany({
        data: notifications,
      });

      const rendered = await this.templatesService.render('generic_notification', {
        subject,
        bodyContent: content.replace(/\n/g, '<br>'),
      });

      for (const user of users) {
        await this.queueNotification(user.email, rendered.subject, rendered.body);
      }

      this.logger.log(`✅ Sent ${notifications.length} notifications to ${role} team`);
    } catch (error: any) {
      this.logger.error(`Failed to send notifications to ${role}: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    type: string,
    subject: string,
    content: string,
    metadata?: any,
  ): Promise<void> {
    if (!VALID_NOTIFICATION_TYPES.has(type)) {
      this.logger.warn(`Invalid notification type: ${type}`);
      throw new Error(`Invalid notification type: ${type}`);
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return;
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId: user.id,
          type: type as any,
          subject,
          content,
          email: user.email,
          status: 'PENDING' as any,
          metadata: metadata ? (metadata as any) : undefined,
        },
      });

      const rendered = await this.templatesService.render('generic_notification', {
        subject,
        bodyContent: content.replace(/\n/g, '<br>'),
      });

      await this.queueNotification(
        user.email,
        rendered.subject,
        rendered.body,
        notification.id,
      );

      this.logger.log(`✅ Queued notification for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to send notification to user ${userId}: ${error?.message}`);
      throw error;
    }
  }
}
