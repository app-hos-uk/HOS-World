import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
// import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  // private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // TODO: Initialize email transporter
    // this.transporter = nodemailer.createTransport({
    //   // Email configuration
    // });
  }

  async sendSellerInvitation(
    email: string,
    data: {
      sellerType: 'WHOLESALER' | 'B2C_SELLER';
      invitationLink: string;
      message?: string;
    },
  ): Promise<void> {
    // TODO: Send email
    // await this.transporter.sendMail({
    //   to: email,
    //   subject: `You've been invited to join as a ${data.sellerType === 'WHOLESALER' ? 'Wholesaler' : 'B2C Seller'}`,
    //   html: this.generateSellerInvitationEmail(data),
    // });

    // Log notification
    console.log(`📧 Seller invitation sent to ${email}`);
    console.log(`   Type: ${data.sellerType}`);
    console.log(`   Link: ${data.invitationLink}`);
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

    // TODO: Send email
    // await this.transporter.sendMail({
    //   to: order.user.email,
    //   subject: `Order Confirmation - ${order.orderNumber}`,
    //   html: this.generateOrderConfirmationEmail(order),
    // });

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

    // TODO: Send email
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

  async sendReturnRequested(returnRequestId: string): Promise<void> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    if (!returnRequest) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: returnRequest.userId,
        type: 'RETURN_REQUESTED',
        subject: `Return Request Submitted - Order ${returnRequest.order.orderNumber}`,
        content: `Your return request for order ${returnRequest.order.orderNumber} has been submitted and is under review.`,
        email: returnRequest.user.email,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async sendReturnApproved(returnRequestId: string): Promise<void> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    if (!returnRequest) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: returnRequest.userId,
        type: 'RETURN_APPROVED',
        subject: `Return Approved - Order ${returnRequest.order.orderNumber}`,
        content: `Your return request for order ${returnRequest.order.orderNumber} has been approved. Please follow the instructions to return your item.`,
        email: returnRequest.user.email,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async sendReturnCompleted(returnRequestId: string): Promise<void> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    if (!returnRequest) {
      return;
    }

    const refundInfo = returnRequest.refundAmount
      ? ` A refund of ${returnRequest.refundAmount} ${returnRequest.order.currency || 'GBP'} will be processed.`
      : '';

    await this.prisma.notification.create({
      data: {
        userId: returnRequest.userId,
        type: 'RETURN_APPROVED', // Using existing type, could add RETURN_COMPLETED
        subject: `Return Completed - Order ${returnRequest.order.orderNumber}`,
        content: `Your return for order ${returnRequest.order.orderNumber} has been processed.${refundInfo}`,
        email: returnRequest.user.email,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async sendReturnRejected(returnRequestId: string): Promise<void> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    if (!returnRequest) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: returnRequest.userId,
        type: 'RETURN_APPROVED', // Using existing type
        subject: `Return Request Update - Order ${returnRequest.order.orderNumber}`,
        content: `Your return request for order ${returnRequest.order.orderNumber} has been reviewed. Please contact support for more information.`,
        email: returnRequest.user.email,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }
}


