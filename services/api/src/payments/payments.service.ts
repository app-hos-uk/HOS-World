import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrencyService } from '../currency/currency.service';
import { PaymentProviderService } from './payment-provider.service';
import { StripeConnectService } from './stripe-connect/stripe-connect.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly BASE_CURRENCY = 'USD';
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private currencyService: CurrencyService,
    private paymentProviderService: PaymentProviderService,
    @Optional() private stripeConnectService?: StripeConnectService,
    @Optional() private vendorLedgerService?: VendorLedgerService,
    @Optional() private notificationsService?: NotificationsService,
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
            stripeConnectAccountId: true,
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

    const paymentAmount =
      createPaymentDto.amount !== undefined ? createPaymentDto.amount : Number(order.total);
    const paymentCurrency = createPaymentDto.currency || order.currency;

    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // Convert payment amount to base currency for processing
    let paymentAmountBase: number;
    if (paymentCurrency === this.BASE_CURRENCY) {
      paymentAmountBase = paymentAmount;
    } else {
      paymentAmountBase = await this.currencyService.convertBetween(
        paymentAmount,
        paymentCurrency,
        this.BASE_CURRENCY,
      );
    }

    const paymentMethod = createPaymentDto.paymentMethod || 'stripe';
    const availableProviders = this.paymentProviderService.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new BadRequestException('No payment providers are available');
    }

    const providerName = this.paymentProviderService.isProviderAvailable(paymentMethod)
      ? paymentMethod
      : availableProviders[0];

    const provider = this.paymentProviderService.getProvider(providerName);

    let clientSecret: string | null = null;
    let paymentIntentId: string | null = null;

    try {
      // Use Stripe Connect split if vendor has a connected account
      const vendorAccountId = order.seller?.stripeConnectAccountId;
      const platformFee = order.platformFeeAmount ? Number(order.platformFeeAmount) : 0;

      if (vendorAccountId && this.stripeConnectService && platformFee > 0) {
        const result = await this.stripeConnectService.createSplitPaymentIntent({
          orderId: order.id,
          amount: paymentAmountBase,
          currency: this.BASE_CURRENCY.toLowerCase(),
          vendorAccountId,
          platformFee,
        });
        paymentIntentId = result.paymentIntentId;
        clientSecret = result.clientSecret || null;
      } else {
        const result = await provider.createPaymentIntent({
          amount: paymentAmountBase,
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
      }
    } catch (error: any) {
      this.logger.error(`Failed to create payment intent with ${providerName}:`, error);
      throw new BadRequestException('Failed to create payment intent. Please try again.');
    }

    return {
      clientSecret,
      paymentIntentId,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency,
        totalBase: paymentAmountBase,
        currencyBase: this.BASE_CURRENCY,
        seller: order.seller
          ? {
              id: order.seller.id,
              storeName: order.seller.storeName,
              slug: order.seller.slug,
              logo: order.seller.logo,
              location: {
                country: order.seller?.country,
                city: order.seller?.city,
              },
            }
          : null,
      },
    };
  }

  async confirmPayment(paymentIntentId: string, orderId: string, userId?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (userId && order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to confirm this payment');
    }

    if (order.stripePaymentIntentId && order.stripePaymentIntentId !== paymentIntentId) {
      throw new BadRequestException('Payment intent does not belong to this order');
    }

    if (order.paymentStatus === 'PAID') {
      this.logger.log(`Order ${orderId} already paid - likely processed by webhook`);
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        stripePaymentId: paymentIntentId,
      },
    });

    // Determine provider from payment method or default to stripe
    const providerName = 'stripe';
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
    amount: number,
  ): Promise<void> {
    let paymentAmountBase: number;
    if (order.currency === this.BASE_CURRENCY) {
      paymentAmountBase = Number(order.total);
    } else {
      paymentAmountBase = await this.currencyService.convertBetween(
        Number(order.total),
        order.currency,
        this.BASE_CURRENCY,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const existingPayment = await tx.payment.findFirst({
        where: { orderId: order.id, status: 'PAID' },
      });

      if (existingPayment) {
        this.logger.log(`Payment already exists for order ${order.id}`);
        return false;
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          stripePaymentId,
          amount: paymentAmountBase,
          currency: this.BASE_CURRENCY,
          status: 'PAID',
          paymentMethod: 'card',
          metadata: {
            originalCurrency: order.currency,
            originalAmount: Number(order.total).toFixed(2),
          } as any,
        },
      });

      const newStatus = order.status === 'PENDING' ? 'CONFIRMED' : order.status;
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          status: newStatus,
          stripePaymentIntentId: stripePaymentId,
        },
      });

      // Cascade paymentStatus and status to child orders (multi-vendor)
      await tx.order.updateMany({
        where: { parentOrderId: order.id },
        data: {
          paymentStatus: 'PAID',
          status: newStatus,
        },
      });

      return true;
    });

    if (!created) return;

    // Record sale in vendor ledger for each child order (or the main order if single-vendor)
    if (this.vendorLedgerService) {
      const childOrders = await this.prisma.order.findMany({
        where: { parentOrderId: order.id },
        include: { seller: true },
      });

      if (childOrders.length > 0) {
        for (const child of childOrders) {
          if (child.sellerId) {
            const commissionRate = child.seller?.commissionRate
              ? Number(child.seller.commissionRate)
              : 0.1;
            await this.vendorLedgerService.recordSale({
              sellerId: child.sellerId,
              orderId: child.id,
              saleAmount: Number(child.subtotal),
              commissionRate,
              currency: child.currency,
            });
          }
        }
      } else if (order.sellerId) {
        const seller = await this.prisma.seller.findUnique({ where: { id: order.sellerId } });
        const commissionRate = seller?.commissionRate ? Number(seller.commissionRate) : 0.1;
        await this.vendorLedgerService.recordSale({
          sellerId: order.sellerId,
          orderId: order.id,
          saleAmount: Number(order.subtotal),
          commissionRate,
          currency: order.currency,
        });
      }
    }

    this.logger.log(`Payment confirmed for order ${order.id}`);

    // Send order confirmation email
    if (this.notificationsService) {
      try {
        await this.notificationsService.sendOrderConfirmation(order.id);
      } catch (err) {
        this.logger.warn(`Failed to send order confirmation for ${order.id}: ${err?.message}`);
      }
    }
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

    const event =
      typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString());
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
