import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrencyService } from '../currency/currency.service';
// import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  // private stripe: Stripe;
  private readonly BASE_CURRENCY = 'GBP';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private currencyService: CurrencyService,
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

    // Convert order total to GBP for payment processing
    let paymentAmountGBP: number;
    if (order.currency === this.BASE_CURRENCY) {
      paymentAmountGBP = Number(order.total);
    } else {
      paymentAmountGBP = await this.currencyService.convertBetween(
        Number(order.total),
        order.currency,
        this.BASE_CURRENCY,
      );
    }

    // TODO: Create Stripe Payment Intent
    // All payments processed in GBP
    // const paymentIntent = await this.stripe.paymentIntents.create({
    //   amount: Math.round(paymentAmountGBP * 100), // Convert to pence (GBP)
    //   currency: 'gbp', // Always GBP for payments
    //   metadata: {
    //     orderId: order.id,
    //     userId,
    //     originalCurrency: order.currency, // Store original currency for reference
    //     originalAmount: Number(order.total).toFixed(2),
    //   },
    // });

    // Return order with seller information revealed (for payment page)
    // Include both original currency (for display) and GBP amount (for processing)
    return {
      clientSecret: 'placeholder-client-secret',
      paymentIntentId: 'placeholder-id',
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency, // Original currency for display
        totalGBP: paymentAmountGBP, // GBP amount for payment processing
        currencyGBP: this.BASE_CURRENCY,
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
    // Get order to get the amount
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Convert order total to GBP for payment record
    let paymentAmountGBP: number;
    if (order.currency === this.BASE_CURRENCY) {
      paymentAmountGBP = Number(order.total);
    } else {
      paymentAmountGBP = await this.currencyService.convertBetween(
        Number(order.total),
        order.currency,
        this.BASE_CURRENCY,
      );
    }

    // TODO: Verify payment with Stripe
    // const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    // if (paymentIntent.status !== 'succeeded') {
    //   throw new BadRequestException('Payment not successful');
    // }

    // Create payment record - always in GBP
    await this.prisma.payment.create({
      data: {
        orderId,
        // stripePaymentId: paymentIntent.id,
        amount: paymentAmountGBP, // Amount in GBP
        currency: this.BASE_CURRENCY, // Always GBP for payments
        status: 'PAID',
        paymentMethod: 'card',
        metadata: {
          originalCurrency: order.currency,
          originalAmount: Number(order.total).toFixed(2),
        } as any,
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


