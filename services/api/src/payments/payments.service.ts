import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
// import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  // private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize Stripe
    // const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    // if (stripeKey) {
    //   this.stripe = new Stripe(stripeKey, { apiVersion: '2024-01-05' });
    // }
  }

  async createPaymentIntent(userId: string, createPaymentDto: CreatePaymentDto): Promise<any> {
    // Get order with seller information (revealed at payment page)
    const order = await this.prisma.order.findFirst({
      where: {
        id: createPaymentDto.orderId,
        userId,
      },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            slug: true,
            logo: true,
            country: true,
            city: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        shippingAddress: true,
        billingAddress: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('Order is already paid');
    }

    // TODO: Create Stripe Payment Intent
    // const paymentIntent = await this.stripe.paymentIntents.create({
    //   amount: Math.round(Number(order.total) * 100), // Convert to cents
    //   currency: order.currency.toLowerCase(),
    //   metadata: {
    //     orderId: order.id,
    //     userId,
    //   },
    // });

    // Return order with seller information revealed (for payment page)
    // For now, return placeholder with order details including seller
    return {
      clientSecret: 'placeholder-client-secret',
      paymentIntentId: 'placeholder-id',
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency,
        seller: {
          id: order.seller.id,
          storeName: order.seller.storeName,
          slug: order.seller.slug,
          logo: order.seller.logo,
          location: {
            country: order.seller.country,
            city: order.seller.city,
          },
        },
      },
    };
  }

  async confirmPayment(paymentIntentId: string, orderId: string): Promise<void> {
    // TODO: Verify payment with Stripe
    // const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    // if (paymentIntent.status !== 'succeeded') {
    //   throw new BadRequestException('Payment not successful');
    // }

    // Create payment record
    await this.prisma.payment.create({
      data: {
        orderId,
        // stripePaymentId: paymentIntent.id,
        amount: 0, // Will be updated with actual amount
        currency: 'USD',
        status: 'PAID',
        paymentMethod: 'card',
      },
    });

    // Update order payment status
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      },
    });
  }

  async handleWebhook(payload: any, signature: string): Promise<void> {
    // TODO: Verify Stripe webhook signature
    // const event = this.stripe.webhooks.constructEvent(
    //   payload,
    //   signature,
    //   this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
    // );

    // Handle different event types
    // switch (event.type) {
    //   case 'payment_intent.succeeded':
    //     await this.handlePaymentSuccess(event.data.object);
    //     break;
    //   case 'payment_intent.payment_failed':
    //     await this.handlePaymentFailure(event.data.object);
    //     break;
    // }
  }
}


