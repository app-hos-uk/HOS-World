import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(NotificationsService.name);
  private emailEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.initializeEmailTransporter();
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
    const subject = `You've been invited to join House of Spells as a ${sellerTypeName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4a5568; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f7fafc; }
          .button { display: inline-block; padding: 12px 24px; background: #4299e1; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>House of Spells Marketplace</h1>
          </div>
          <div class="content">
            <h2>You've Been Invited!</h2>
            <p>You have been invited to join House of Spells Marketplace as a <strong>${sellerTypeName}</strong>.</p>
            ${data.message ? `<p>${data.message}</p>` : ''}
            <a href="${data.invitationLink}" class="button">Accept Invitation</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4299e1;">${data.invitationLink}</p>
            <p>This invitation will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>House of Spells Marketplace - Your magical shopping destination</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(email, subject, html);
    this.logger.log(`📧 Seller invitation sent to ${email} (${sellerTypeName})`);
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

    const subject = `Order Confirmation - ${order.orderNumber}`;
    const html = this.generateOrderConfirmationEmail(order);
    await this.sendEmail(order.user.email, subject, html);

    // Log notification
    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_CONFIRMATION',
        subject: `Order Confirmation - ${order.orderNumber}`,
        content: `Your order ${order.orderNumber} has been confirmed.`,
        email: order.user.email,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async sendOrderShipped(orderId: string, trackingCode: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return;
    }

    const subject = `Your Order Has Shipped - ${order.orderNumber}`;
    const html = this.generateOrderShippedEmail(order, trackingCode);
    await this.sendEmail(order.user.email, subject, html);

    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_SHIPPED',
        subject: `Your Order Has Shipped - ${order.orderNumber}`,
        content: `Your order ${order.orderNumber} has been shipped. Tracking: ${trackingCode}`,
        email: order.user.email,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async sendOrderDelivered(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return;
    }

    const subject = `Order Delivered - ${order.orderNumber}`;
    const html = this.generateOrderDeliveredEmail(order);
    await this.sendEmail(order.user.email, subject, html);

    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_DELIVERED',
        subject: `Order Delivered - ${order.orderNumber}`,
        content: `Your order ${order.orderNumber} has been delivered.`,
        email: order.user.email,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  private generateOrderConfirmationEmail(order: any): string {
    const itemsHtml = order.items
      .map(
        (item: any) => `
      <tr>
        <td>${item.product.name}</td>
        <td>${item.quantity}</td>
        <td>£${item.price.toFixed(2)}</td>
        <td>£${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4a5568; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f7fafc; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #e2e8f0; }
          .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmation</h1>
          </div>
          <div class="content">
            <h2>Thank you for your order!</h2>
            <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div class="total">Total: £${order.total.toFixed(2)}</div>
            <p>We'll send you another email when your order ships.</p>
          </div>
          <div class="footer">
            <p>House of Spells Marketplace</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateOrderShippedEmail(order: any, trackingCode: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4299e1; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f7fafc; }
          .tracking { background: #edf2f7; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Order Has Shipped!</h1>
          </div>
          <div class="content">
            <h2>Great news!</h2>
            <p>Your order <strong>${order.orderNumber}</strong> has been shipped.</p>
            <div class="tracking">
              <strong>Tracking Code:</strong> ${trackingCode}
            </div>
            <p>You can track your order using the tracking code above.</p>
          </div>
          <div class="footer">
            <p>House of Spells Marketplace</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateOrderDeliveredEmail(order: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #48bb78; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f7fafc; }
          .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Delivered!</h1>
          </div>
          <div class="content">
            <h2>Your order has been delivered</h2>
            <p>Your order <strong>${order.orderNumber}</strong> has been successfully delivered.</p>
            <p>We hope you enjoy your purchase! If you have any questions, please don't hesitate to contact us.</p>
          </div>
          <div class="footer">
            <p>House of Spells Marketplace</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async getUserNotifications(userId: string): Promise<any[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 notifications
    });
    return notifications;
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

      // Send emails
      for (const user of users) {
        await this.sendEmail(
          user.email,
          subject,
          `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4a5568; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f7fafc; }
              .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${subject}</h1>
              </div>
              <div class="content">
                ${content.replace(/\n/g, '<br>')}
              </div>
              <div class="footer">
                <p>House of Spells Marketplace</p>
              </div>
            </div>
          </body>
          </html>
        `,
        );
      }

      this.logger.log(`✅ Sent ${notifications.length} notifications to ${role} team`);
    } catch (error: any) {
      this.logger.error(`Failed to send notifications to ${role}: ${error?.message}`);
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
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return;
      }

      await this.prisma.notification.create({
        data: {
          userId: user.id,
          type: type as any,
          subject,
          content,
          email: user.email,
          status: 'SENT',
          sentAt: new Date(),
          metadata: metadata ? (metadata as any) : undefined,
        },
      });

      await this.sendEmail(
        user.email,
        subject,
        `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4a5568; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f7fafc; }
            .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${subject}</h1>
            </div>
            <div class="content">
              ${content.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>House of Spells Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `,
      );

      this.logger.log(`✅ Sent notification to user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to send notification to user ${userId}: ${error?.message}`);
    }
  }
}
