import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrencyService } from '../currency/currency.service';
import { PaymentProviderService } from './payment-provider.service';

@Injectable()
export class PaymentsService {
  private readonly BASE_CURRENCY = 'GBP';
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private currencyService: CurrencyService,
    private paymentProviderService: PaymentProviderService,
  ) {
    this.logger.log('PaymentsService initialized with payment provider framework');
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

    // Use provided amount if available (e.g., after gift card redemption), otherwise use order total
    const paymentAmount = createPaymentDto.amount !== undefined ? createPaymentDto.amount : Number(order.total);
    const paymentCurrency = createPaymentDto.currency || order.currency;

    // Convert payment amount to GBP for payment processing
    let paymentAmountGBP: number;
    if (paymentCurrency === this.BASE_CURRENCY) {
      paymentAmountGBP = paymentAmount;
    } else {
      paymentAmountGBP = await this.currencyService.convertBetween(
        paymentAmount,
        paymentCurrency,
        this.BASE_CURRENCY,
      );
    }

    // Determine payment provider (default to 'stripe' or first available)
    const paymentMethod = createPaymentDto.paymentMethod || 'stripe';
    const availableProviders = this.paymentProviderService.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new BadRequestException('No payment providers are available');
    }

    const providerName = this.paymentProviderService.isProviderAvailable(paymentMethod)
      ? paymentMethod
      : availableProviders[0];

    const provider = this.paymentProviderService.getProvider(providerName);

    // Create payment intent using provider
    let clientSecret: string | null = null;
    let paymentIntentId: string | null = null;

    try {
      const result = await provider.createPaymentIntent({
        amount: paymentAmountGBP,
        currency: this.BASE_CURRENCY.toLowerCase(),
        orderId: order.id,
        customerId: userId,
        metadata: {
          originalCurrency: order.currency,
          originalAmount: Number(order.total).toFixed(2),
        },
      });

      paymentIntentId = result.paymentIntentId;
      clientSecret = result.clientSecret || null;
    } catch (error: any) {
      this.logger.error(`Failed to create payment intent with ${providerName}:`, error);
      throw new BadRequestException(`Failed to create payment intent: ${error.message}`);
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

    // Get payment record to determine provider
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        stripePaymentId: paymentIntentId, // This field stores payment intent ID from any provider
      },
    });

    // Determine provider from payment method or default to stripe
    const providerName = payment?.paymentMethod === 'klarna' ? 'klarna' : 'stripe';
    const provider = this.paymentProviderService.getProvider(providerName);

    try {
      const result = await provider.confirmPayment({
        paymentIntentId,
        orderId,
      });

      if (!result.success) {
        throw new BadRequestException(
          result.error || `Payment not successful. Status: ${result.status}`,
        );
      }

      // Process payment (webhook may have already done this, but idempotent)
      await this.markPaymentAsPaid(order, result.paymentId, result.amount);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to verify payment with ${providerName}:`, error);
      throw new BadRequestException('Failed to verify payment');
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

  async handleWebhook(
    payload: Buffer | string,
    signature: string,
    providerName: string = 'stripe',
  ): Promise<void> {
    const provider = this.paymentProviderService.getProvider(providerName);

    if (!provider.validateWebhook(payload, signature)) {
      this.logger.error(`Webhook signature validation failed for ${providerName}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString());
    this.logger.log(`Received ${providerName} webhook: ${event.type || 'unknown'}`);

    const result = await provider.processWebhook(event);

    if (result.processed && result.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: result.orderId },
      });

      if (!order) {
        this.logger.error(`Order not found for webhook: ${result.orderId}`);
        return;
      }

      // Handle based on event type
      if (event.type?.includes('succeeded') || event.type?.includes('success')) {
        await this.handlePaymentSuccess(order, result.paymentId || '', result.metadata);
      } else if (event.type?.includes('failed') || event.type?.includes('failure')) {
        await this.handlePaymentFailure(order, result.paymentId || '');
      }
    }
  }

  /**
   * Handle successful payment (webhook authoritative)
   */
  private async handlePaymentSuccess(
    order: any,
    paymentId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Webhook is authoritative - mark as paid
    const amount = metadata?.amount || Number(order.total);
    await this.markPaymentAsPaid(order, paymentId, amount);
    this.logger.log(`Payment succeeded for order ${order.id} via webhook`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(order: any, paymentId: string): Promise<void> {
    // Update order payment status to FAILED
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'FAILED',
      },
    });

    // Create payment record with FAILED status
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        stripePaymentId: paymentId, // Store payment ID from any provider
        amount: Number(order.total),
        currency: this.BASE_CURRENCY,
        status: 'FAILED',
        paymentMethod: 'card',
        metadata: {
          failureReason: 'Payment failed',
        } as any,
      },
    });

    this.logger.log(`Payment failed for order ${order.id} via webhook`);
  }

  /**
   * Get available payment providers
   */
  getAvailableProviders(): string[] {
    return this.paymentProviderService.getAvailableProviders();
  }
}


