import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrencyService } from '../currency/currency.service';
import { PaymentProviderService } from './payment-provider.service';
import { StripeConnectService } from './stripe-connect/stripe-connect.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PosInventorySyncService } from '../pos/sync/inventory-sync.service';
import { MarketingEventBus } from '../journeys/marketing-event.bus';
import { RedisService } from '../cache/redis.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { DEFAULT_PLATFORM_FEE_RATE } from '../common/platform-config';
import { Decimal } from '@prisma/client/runtime/library';

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
    @Optional() @Inject(forwardRef(() => LoyaltyService)) private loyaltyService?: LoyaltyService,
    @Optional()
    @Inject(forwardRef(() => PosInventorySyncService))
    private posInventorySync?: PosInventorySyncService,
    @Optional() @Inject(forwardRef(() => MarketingEventBus))
    private marketingBus?: MarketingEventBus,
    @Optional() private redisService?: RedisService,
    @Optional() private integrationsService?: IntegrationsService,
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

    const paymentAmount = await this.computePayableAmount(order.id, Number(order.total));
    const paymentCurrency = createPaymentDto.currency || order.currency;

    // If gift-card redemptions fully cover the order total, complete the order without
    // creating a Stripe payment intent. This prevents orders from getting stuck in PENDING.
    if (paymentAmount <= 0) {
      await this.markPaymentAsPaid(order, 'gift_card_full_coverage', 0);
      this.logger.log(`Order ${order.id} fully covered by gift cards — marked PAID`);
      return {
        paid: true,
        method: 'gift_card_full_coverage',
        orderId: order.id,
        message: 'Order fully covered by gift card balance — no card payment required.',
      };
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

    // Cancel any prior intent to avoid leaving chargeable orphans.
    // If the prior intent already succeeded (customer was charged), skip creating
    // a new one — the webhook will eventually mark the order as paid.
    if (order.stripePaymentIntentId) {
      try {
        if (provider.cancelPaymentIntent) {
          const cancelStatus = await provider.cancelPaymentIntent(order.stripePaymentIntentId);
          if (cancelStatus === 'already_succeeded') {
            this.logger.warn(
              `Prior intent ${order.stripePaymentIntentId} already succeeded for order ${order.id} — not creating a new intent`,
            );
            return {
              success: true,
              paymentIntentId: order.stripePaymentIntentId,
              clientSecret: null,
              message: 'Payment already processed. Please wait for confirmation.',
            };
          }
          this.logger.log(`Cancelled prior intent ${order.stripePaymentIntentId} for order ${order.id}`);
        }
      } catch (cancelErr: any) {
        this.logger.warn(
          `Could not cancel prior intent ${order.stripePaymentIntentId}: ${cancelErr?.message}`,
        );
      }
    }

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

    if (paymentIntentId) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentIntentId: paymentIntentId },
      });
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

      const intentOrderId = result.metadata?.orderId;
      if (!intentOrderId || intentOrderId !== orderId) {
        throw new BadRequestException('Payment intent does not belong to this order');
      }

      const expectedAmount = await this.computePayableAmount(orderId, Number(order.total));
      const expectedAmountBase =
        order.currency === this.BASE_CURRENCY
          ? expectedAmount
          : await this.currencyService.convertBetween(
              expectedAmount,
              order.currency,
              this.BASE_CURRENCY,
            );
      const expectedCents = Math.round(expectedAmountBase * 100);
      const paidCents = Math.round((result.amount || 0) * 100);
      if (Math.abs(paidCents - expectedCents) > 1) {
        throw new BadRequestException('Payment amount does not match order total');
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
    // Use the actual card amount (passed in), not order.total which includes gift-card coverage
    const cardAmount = amount > 0 ? amount : Number(order.total);
    let paymentAmountBase: number;
    if (order.currency === this.BASE_CURRENCY) {
      paymentAmountBase = cardAmount;
    } else {
      paymentAmountBase = await this.currencyService.convertBetween(
        cardAmount,
        order.currency,
        this.BASE_CURRENCY,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // Double-check: bail out if the order is already paid (guards against
      // concurrent duplicate webhooks when Redis dedup is unavailable).
      const freshOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { paymentStatus: true },
      });
      if (freshOrder?.paymentStatus === 'PAID') {
        this.logger.log(`Order ${order.id} already PAID — skipping duplicate`);
        return false;
      }

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
    // Uses retry to handle transient failures since this runs after the payment transaction
    if (this.vendorLedgerService) {
      try {
        const childOrders = await this.prisma.order.findMany({
          where: { parentOrderId: order.id },
          include: { seller: true },
        });

        if (childOrders.length > 0) {
          for (const child of childOrders) {
            if (child.sellerId) {
              const commissionRate = child.seller?.commissionRate
                ? Number(child.seller.commissionRate)
                : DEFAULT_PLATFORM_FEE_RATE;
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
          const commissionRate = seller?.commissionRate ? Number(seller.commissionRate) : DEFAULT_PLATFORM_FEE_RATE;
          await this.vendorLedgerService.recordSale({
            sellerId: order.sellerId,
            orderId: order.id,
            saleAmount: Number(order.subtotal),
            commissionRate,
            currency: order.currency,
          });
        }
      } catch (ledgerErr: any) {
        // Payment is confirmed but ledger write failed — log for reconciliation
        this.logger.error(
          `RECONCILIATION NEEDED: Vendor ledger recordSale failed for order ${order.id} after payment confirmed: ${ledgerErr?.message}`,
        );
      }
    }

    // Record transaction for finance dashboard visibility
    try {
      await this.prisma.transaction.create({
        data: {
          type: 'PAYMENT',
          amount: paymentAmountBase,
          currency: this.BASE_CURRENCY,
          status: 'COMPLETED',
          customerId: order.userId,
          sellerId: order.sellerId || undefined,
          orderId: order.id,
          description: `Payment for order ${order.orderNumber || order.id}`,
          metadata: {
            stripePaymentId,
            originalCurrency: order.currency,
            originalAmount: Number(order.total).toFixed(2),
          },
        },
      });
    } catch (txErr: any) {
      this.logger.warn(
        `Finance transaction record failed for order ${order.id}: ${txErr?.message}`,
      );
    }

    // Activate influencer commissions: PENDING -> APPROVED, then increment stats once
    try {
      const pendingCommissions = await this.prisma.influencerCommission.findMany({
        where: { orderId: order.id, status: 'PENDING' },
        include: { referral: true },
      });

      for (const comm of pendingCommissions) {
        const activated = await this.prisma.influencerCommission.updateMany({
          where: { id: comm.id, status: 'PENDING' },
          data: { status: 'APPROVED' },
        });
        if (activated.count === 0) {
          continue;
        }

        await this.prisma.influencer.update({
          where: { id: comm.influencerId },
          data: {
            totalConversions: { increment: 1 },
            totalSalesAmount: { increment: comm.orderTotal },
            totalCommission: { increment: comm.amount },
          },
        });

        const meta = comm.metadata as {
          campaignId?: string;
          campaignAttributedSales?: string;
        } | null;
        const campaignId = meta?.campaignId ?? comm.referral?.campaignId ?? null;
        if (campaignId) {
          const campaignSales = meta?.campaignAttributedSales
            ? new Decimal(meta.campaignAttributedSales)
            : comm.orderTotal;

          await this.prisma.influencerCampaign.update({
            where: { id: campaignId },
            data: {
              totalConversions: { increment: 1 },
              totalSales: { increment: campaignSales },
            },
          });
        }
      }
    } catch (commErr: any) {
      this.logger.warn(`Influencer commission activation failed for order ${order.id}: ${commErr?.message}`);
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

    if (this.loyaltyService && this.configService.get<string>('LOYALTY_ENABLED') === 'true') {
      try {
        const rootOrderId = order.parentOrderId || order.id;
        await this.loyaltyService.processOrderComplete(rootOrderId);
      } catch (err: any) {
        this.logger.warn(`Loyalty earn failed after payment for ${order.id}: ${err?.message ?? err}`);
      }
    }

    try {
      await this.markAbandonedCartRecovery(order.userId);
    } catch (e: any) {
      this.logger.warn(`Abandoned cart recovery failed for ${order.id}: ${e?.message ?? e}`);
    }

    if (this.marketingBus) {
      try {
        const rootId = order.parentOrderId || order.id;
        const enriched = await this.prisma.order.findUnique({
          where: { id: order.id },
          include: {
            items: { include: { product: true }, take: 1 },
          },
        });
        const lt = await this.prisma.loyaltyTransaction.findFirst({
          where: {
            membership: { userId: order.userId },
            source: 'PURCHASE',
            sourceId: rootId,
          },
          orderBy: { createdAt: 'desc' },
        });
        void this.marketingBus
          .emit('ORDER_PAID', order.userId, {
            orderId: rootId,
            orderNumber: enriched?.orderNumber ?? order.orderNumber,
            totalAmount: String(enriched?.total ?? order.total),
            loyaltyPointsEarned: lt?.points ?? 0,
            productName: enriched?.items?.[0]?.product?.name ?? 'your purchase',
          })
          .catch((e: any) => this.logger.warn(`Marketing event emit failed: ${e?.message}`));
      } catch (e: any) {
        this.logger.warn(`Marketing ORDER_PAID hook failed: ${e?.message ?? e}`);
      }
    }

    if (this.posInventorySync && this.configService.get<string>('POS_ENABLED') === 'true') {
      try {
        const rootOrderId = order.parentOrderId || order.id;
        await this.posInventorySync.syncOnlineOrderToPos(rootOrderId);
      } catch (err: any) {
        this.logger.warn(`POS inventory sync after payment failed for ${order.id}: ${err?.message ?? err}`);
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

    // Deduplicate by Stripe event id (retries / duplicate delivery).
    // When Redis is down, fall through and process the event — better to risk a
    // duplicate (markPaymentAsPaid is already idempotent) than to silently drop
    // a payment confirmation.
    const eventId = typeof event?.id === 'string' ? event.id : null;
    if (eventId && this.redisService?.isRedisConnected()) {
      try {
        const dedupeKey = `stripe:webhook:${eventId}`;
        const isNew = await this.redisService.setNX(dedupeKey, '1', 7 * 24 * 60 * 60);
        if (!isNew) {
          this.logger.log(`Skipping duplicate webhook event ${eventId}`);
          return;
        }
      } catch (redisErr: any) {
        this.logger.warn(`Webhook dedup Redis error (proceeding anyway): ${redisErr?.message}`);
      }
    }

    // Only act on an explicit allow-list of event types. Loose substring matching
    // ('includes("succeeded")') can misfire on unrelated events whose data.object is not a
    // PaymentIntent, leading to incorrect order state changes.
    const SUCCESS_EVENTS = new Set(['payment_intent.succeeded', 'charge.succeeded']);
    const FAILURE_EVENTS = new Set([
      'payment_intent.payment_failed',
      'charge.failed',
    ]);
    const DISPUTE_EVENTS = new Set([
      'charge.dispute.created',
      'charge.dispute.updated',
      'charge.dispute.closed',
    ]);

    const isSuccess = SUCCESS_EVENTS.has(event.type);
    const isFailure = FAILURE_EVENTS.has(event.type);
    const isDispute = DISPUTE_EVENTS.has(event.type);

    if (!isSuccess && !isFailure && !isDispute) {
      this.logger.log(`Ignoring unhandled webhook event type: ${event.type}`);
      return;
    }

    // Handle disputes separately — they reference a charge, not a PI
    if (isDispute) {
      await this.handleDispute(event);
      return;
    }

    const result = await provider.processWebhook(event);

    if (result.processed && result.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: result.orderId },
      });

      if (!order) {
        this.logger.error(`Order not found for webhook: ${result.orderId}`);
        return;
      }

      // Defense-in-depth: ensure the payment intent's metadata orderId matches the order.
      if (result.metadata?.orderId && result.metadata.orderId !== order.id) {
        this.logger.error(
          `Webhook orderId mismatch: intent=${result.metadata.orderId} order=${order.id}`,
        );
        return;
      }

      if (isSuccess) {
        // Amount actually captured by Stripe, in the smallest unit of the base currency.
        const paidCents = Number(event.data?.object?.amount_received ?? event.data?.object?.amount ?? 0);
        await this.handlePaymentSuccess(order, result.paymentId || '', paidCents);
      } else if (isFailure) {
        await this.handlePaymentFailure(order, result.paymentId || '');
      }
    }
  }

  /**
   * Handle successful payment (webhook authoritative). Verifies the captured amount matches
   * the server-computed payable amount before marking the order paid.
   */
  private async handlePaymentSuccess(
    order: any,
    paymentId: string,
    paidCents: number,
  ): Promise<void> {
    const expectedAmount = await this.computePayableAmount(order.id, Number(order.total));
    const expectedAmountBase =
      order.currency === this.BASE_CURRENCY
        ? expectedAmount
        : await this.currencyService.convertBetween(
            expectedAmount,
            order.currency,
            this.BASE_CURRENCY,
          );
    const expectedCents = Math.round(expectedAmountBase * 100);

    if (paidCents > 0 && Math.abs(paidCents - expectedCents) > 1) {
      this.logger.error(
        `Webhook amount mismatch for order ${order.id}: paid=${paidCents} expected=${expectedCents}`,
      );
      throw new BadRequestException('Webhook payment amount does not match order total');
    }

    await this.markPaymentAsPaid(order, paymentId, expectedAmountBase);
    this.logger.log(`Payment succeeded for order ${order.id} via webhook`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(order: any, paymentId: string): Promise<void> {
    // Never override an already-paid order with FAILED (out-of-order webhook delivery).
    if (order.paymentStatus === 'PAID') {
      this.logger.warn(
        `Ignoring failure webhook for already-paid order ${order.id}`,
      );
      return;
    }

    // Update order payment status to FAILED
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'FAILED',
      },
    });

    // Create payment record with FAILED status (idempotent: skip if one already exists
    // for this provider payment id).
    const existingFailure = await this.prisma.payment.findFirst({
      where: { orderId: order.id, stripePaymentId: paymentId, status: 'FAILED' },
    });
    if (!existingFailure) {
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
    }

    this.logger.log(`Payment failed for order ${order.id} via webhook`);
  }

  /**
   * Handle Stripe dispute webhooks (charge.dispute.created/updated/closed).
   * Flags the associated order and logs for admin review.
   */
  private async handleDispute(event: any): Promise<void> {
    const dispute = event.data?.object;
    if (!dispute) return;

    const chargeId = dispute.charge;
    const paymentIntentId = dispute.payment_intent;
    const status = dispute.status; // needs_response, under_review, won, lost
    const amount = dispute.amount; // cents
    const reason = dispute.reason;

    this.logger.warn(
      `Dispute ${event.type}: id=${dispute.id} status=${status} reason=${reason} amount=${amount} charge=${chargeId} pi=${paymentIntentId}`,
    );

    // Find order by payment intent ID
    let order = paymentIntentId
      ? await this.prisma.order.findFirst({ where: { stripePaymentIntentId: paymentIntentId } })
      : null;

    // Fallback: find by charge stored in payment records
    if (!order && chargeId) {
      const payment = await this.prisma.payment.findFirst({
        where: { stripePaymentId: chargeId },
      });
      if (payment) {
        order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
      }
    }

    if (!order) {
      this.logger.error(`Dispute ${dispute.id}: could not find associated order`);
      return;
    }

    if (event.type === 'charge.dispute.created') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'DISPUTED' },
      });
      // Record dispute details on the payment record
      await this.prisma.payment.updateMany({
        where: { orderId: order.id, stripePaymentId: paymentIntentId || chargeId },
        data: {
          metadata: {
            disputeId: dispute.id,
            disputeReason: reason,
            disputeAmount: amount,
            disputeStatus: status,
            disputeCreatedAt: new Date().toISOString(),
          } as any,
        },
      });
      this.logger.warn(`Order ${order.id} marked as DISPUTED (${reason})`);
    } else if (event.type === 'charge.dispute.closed') {
      if (status === 'lost') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'REFUNDED' },
        });
        this.logger.warn(`Dispute lost for order ${order.id} — marked REFUNDED`);
      } else if (status === 'won') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID' },
        });
        this.logger.log(`Dispute won for order ${order.id} — restored to PAID`);
      }
    }
  }

  private async markAbandonedCartRecovery(userId: string): Promise<void> {
    const journey = await this.prisma.marketingJourney.findUnique({
      where: { slug: 'abandoned-cart' },
    });
    if (!journey) return;
    const rows = await this.prisma.journeyEnrollment.findMany({
      where: { userId, journeyId: journey.id, status: 'ACTIVE' },
    });
    for (const e of rows) {
      const meta = { ...((e.metadata as object) || {}), cartRecovered: true };
      await this.prisma.journeyEnrollment.update({
        where: { id: e.id },
        data: { metadata: meta as object },
      });
    }
  }

  /**
   * Compute the amount still owed on an order (after gift card redemptions).
   */
  private async computePayableAmount(orderId: string, orderTotal: number): Promise<number> {
    const redemptions = await this.prisma.giftCardTransaction.findMany({
      where: { orderId, type: 'REDEMPTION' },
      select: { amount: true },
    });
    const redeemed = redemptions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const payable = orderTotal - redeemed;
    return Math.max(0, Math.round(payable * 100) / 100);
  }

  /**
   * Get available payment providers
   */
  getAvailableProviders(): string[] {
    return this.paymentProviderService.getAvailableProviders();
  }

  /**
   * Get Stripe publishable key for frontend Stripe.js initialization.
   * Reads from STRIPE_PUBLISHABLE_KEY env var or from admin integrations DB.
   */
  async getStripePublishableKey(): Promise<string | null> {
    const envKey = this.configService.get<string>('STRIPE_PUBLISHABLE_KEY');
    if (envKey) return envKey;

    try {
      if (!this.integrationsService) return null;
      const creds = await this.integrationsService.getDecryptedCredentials('PAYMENT', 'stripe');
      return creds.publishableKey?.trim() || null;
    } catch {
      return null;
    }
  }
}
