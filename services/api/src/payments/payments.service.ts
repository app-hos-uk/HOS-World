import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrencyService } from '../currency/currency.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly BASE_CURRENCY = 'GBP';
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private currencyService: CurrencyService,
  ) {
    // Initialize Stripe
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2024-01-05' });
      this.logger.log('Stripe initialized');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set - Stripe payments disabled');
    }
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

    // Create Stripe Payment Intent if Stripe is configured
    let clientSecret: string | null = null;
    let paymentIntentId: string | null = null;

    if (this.stripe) {
      try {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(paymentAmountGBP * 100), // Convert to pence (GBP)
          currency: 'gbp', // Always GBP for payments
          metadata: {
            orderId: order.id,
            userId,
            originalCurrency: order.currency, // Store original currency for reference
            originalAmount: Number(order.total).toFixed(2),
          },
        });

        clientSecret = paymentIntent.client_secret;
        paymentIntentId = paymentIntent.id;

        // Store payment intent ID in order metadata for webhook lookup
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            metadata: {
              ...((order.metadata as any) || {}),
              stripePaymentIntentId: paymentIntent.id,
            } as any,
          },
        });
      } catch (error) {
        this.logger.error('Failed to create Stripe payment intent:', error);
        throw new BadRequestException('Failed to create payment intent');
      }
    } else {
      // Fallback for development/testing without Stripe
      paymentIntentId = `test_${order.id}_${Date.now()}`;
      clientSecret = 'test_client_secret';
      this.logger.warn('Stripe not configured - using test payment intent');
    }

    // Return order with seller information revealed (for payment page)
    // Include both original currency (for display) and GBP amount (for processing)
    return {
      clientSecret,
      paymentIntentId,
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

    // Check if already paid (webhook may have processed it)
    if (order.paymentStatus === 'PAID') {
      this.logger.log(`Order ${orderId} already paid - likely processed by webhook`);
      return;
    }

    // Verify payment with Stripe if configured
    if (this.stripe) {
      try {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
          throw new BadRequestException(`Payment not successful. Status: ${paymentIntent.status}`);
        }

        // Verify order ID matches
        if (paymentIntent.metadata.orderId !== orderId) {
          throw new BadRequestException('Payment intent does not match order');
        }

        // Process payment (webhook may have already done this, but idempotent)
        await this.markPaymentAsPaid(order, paymentIntent.id, paymentIntent.amount / 100);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error('Failed to verify payment with Stripe:', error);
        throw new BadRequestException('Failed to verify payment');
      }
    } else {
      // Fallback for development/testing without Stripe
      this.logger.warn('Stripe not configured - marking payment as paid without verification');
      await this.markPaymentAsPaid(order, paymentIntentId, Number(order.total));
    }
  }

  /**
   * Mark payment as paid (idempotent - safe to call multiple times)
   */
  private async markPaymentAsPaid(
    order: any,
    stripePaymentId: string,
    amountGBP: number,
  ): Promise<void> {
    // Check if payment already exists
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: 'PAID',
      },
    });

    if (existingPayment) {
      this.logger.log(`Payment already exists for order ${order.id}`);
      return;
    }

    // Convert order total to GBP for payment record if needed
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

    // Create payment record - always in GBP
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentId,
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

    // Update order payment status and status
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: order.status === 'PENDING' ? 'CONFIRMED' : order.status, // Only transition from PENDING to CONFIRMED
      },
    });

    this.logger.log(`Payment confirmed for order ${order.id}`);
  }

  async handleWebhook(payload: Buffer | string, signature: string): Promise<void> {
    if (!this.stripe) {
      this.logger.warn('Stripe not configured - webhook ignored');
      return;
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured - cannot verify webhook');
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Handle successful payment (webhook authoritative)
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      this.logger.error('Payment intent missing orderId metadata');
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`Order not found for payment intent ${paymentIntent.id}`);
      return;
    }

    // Webhook is authoritative - mark as paid
    await this.markPaymentAsPaid(order, paymentIntent.id, paymentIntent.amount / 100);
    this.logger.log(`Payment succeeded for order ${orderId} via webhook`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      this.logger.error('Payment intent missing orderId metadata');
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`Order not found for payment intent ${paymentIntent.id}`);
      return;
    }

    // Update order payment status to FAILED
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'FAILED',
      },
    });

    // Create payment record with FAILED status
    await this.prisma.payment.create({
      data: {
        orderId,
        stripePaymentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: this.BASE_CURRENCY,
        status: 'FAILED',
        paymentMethod: 'card',
        metadata: {
          failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
        } as any,
      },
    });

    this.logger.log(`Payment failed for order ${orderId} via webhook`);
  }
}


