import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateGiftCardDto } from './dto/create-gift-card.dto';
import { RedeemGiftCardDto } from './dto/redeem-gift-card.dto';
import { PlatformRegionService } from '../config/platform-region.service';

/** Matches codes from generateCode(): XXXX-XXXX-XXXX-XXXX, charset without I,O,0,1 */
const GIFT_CARD_CODE_REGEX =
  /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

@Injectable()
export class GiftCardsService {
  private readonly logger = new Logger(GiftCardsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly platformRegion: PlatformRegionService,
  ) {}

  private isExpired(card: { expiresAt?: Date | null }): boolean {
    return !!card.expiresAt && card.expiresAt < new Date();
  }

  /**
   * Stored status lags behind the clock: a card is only flipped to EXPIRED by
   * the sweep job. Reads project the expiry so an admin never sees a card the
   * checkout already rejects still labelled ACTIVE.
   */
  private withEffectiveStatus<T extends { status: string; expiresAt?: Date | null }>(card: T): T {
    if (card.status === 'ACTIVE' && this.isExpired(card)) {
      return { ...card, status: 'EXPIRED' };
    }
    return card;
  }

  /**
   * Flip live cards whose expiry has passed. Run on a schedule so the stored
   * status, admin filters, and accounting reports agree with what redemption
   * enforces.
   */
  async expireOverdueGiftCards(): Promise<number> {
    const result = await this.prisma.giftCard.updateMany({
      where: { status: 'ACTIVE', expiresAt: { not: null, lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} gift card(s) as EXPIRED`);
    }
    return result.count;
  }

  /**
   * Reject redemption by anyone other than the card's intended holder.
   *
   * `userId` is authoritative once set. Before that, a card issued to an email
   * is still reserved for that address — the recipient may simply have signed
   * up after the card was created, so match on email and let them claim it.
   * Cards with neither an owner nor a recipient email remain bearer
   * instruments and any authenticated holder of the code may redeem them.
   */
  private async assertRedeemerOwnsCard(
    db: Pick<Prisma.TransactionClient, 'user'>,
    card: { userId?: string | null; issuedToEmail?: string | null },
    userId: string,
  ): Promise<void> {
    if (card.userId) {
      if (card.userId !== userId) {
        throw new ForbiddenException(
          'This gift card is assigned to another customer and cannot be redeemed by you',
        );
      }
      return;
    }
    if (!card.issuedToEmail) return;

    const redeemer = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const issuedTo = card.issuedToEmail.trim().toLowerCase();
    if ((redeemer?.email ?? '').trim().toLowerCase() !== issuedTo) {
      throw new ForbiddenException(
        'This gift card is assigned to another customer and cannot be redeemed by you',
      );
    }
  }

  /** Persist EXPIRED for a single card found stale during validate/redeem. */
  private async settleExpiredStatus(card: { id: string; status: string }): Promise<void> {
    if (card.status !== 'ACTIVE') return;
    try {
      await this.prisma.giftCard.updateMany({
        where: { id: card.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
    } catch (err) {
      this.logger.warn(`Could not mark gift card ${card.id} expired: ${(err as Error).message}`);
    }
  }

  private parseGiftCardCode(raw: string): string {
    let decoded = (raw ?? '').trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      throw new BadRequestException('Invalid gift card code format');
    }
    const code = decoded.trim().toUpperCase();
    if (code.length !== 19 || !GIFT_CARD_CODE_REGEX.test(code)) {
      throw new BadRequestException('Invalid gift card code format');
    }
    return code;
  }

  /**
   * Preset purchase amounts. Prefers Admin Loyalty Settings (PLATFORM config),
   * then GIFT_CARD_CATALOG_AMOUNTS / GIFT_CARD_DEFAULT_CURRENCY env.
   */
  private async defaultCurrency(): Promise<string> {
    return (
      this.configService.get<string>('GIFT_CARD_DEFAULT_CURRENCY') ||
      (await this.platformRegion.getCurrency())
    );
  }

  async getCatalog(): Promise<{ currency: string; amounts: number[] }> {
    let raw = this.configService.get<string>('GIFT_CARD_CATALOG_AMOUNTS') || '25,50,100,250,500';
    let currency = await this.defaultCurrency();
    try {
      const row = await this.prisma.config.findFirst({
        where: { level: 'PLATFORM', levelId: 'PLATFORM', key: 'LOYALTY_PROGRAMME_SETTINGS' },
      });
      const v = row?.value as {
        giftCardCatalogAmounts?: string;
        giftCardDefaultCurrency?: string;
      } | null;
      if (v?.giftCardCatalogAmounts) raw = v.giftCardCatalogAmounts;
      if (v?.giftCardDefaultCurrency) currency = v.giftCardDefaultCurrency;
    } catch {
      /* env / region fallback */
    }
    const amounts = raw
      .split(/[,;\s]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
    return {
      currency,
      amounts: amounts.length ? amounts : [25, 50, 100, 250, 500],
    };
  }

  // GiftCard model is now in schema - no need for throwNotImplemented

  /**
   * Generate unique gift card code
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking chars
    let code = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create/purchase a gift card
   */
  async create(userId: string, dto: CreateGiftCardDto): Promise<any> {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Gift card amount must be greater than zero');
    }

    // Generate unique code
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = this.generateCode();
      const existing = await (this.prisma as any).giftCard.findUnique({
        where: { code },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique gift card code');
    }

    // Parse expiresAt if provided
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // userId identifies the holder the card is assigned to, never the admin who
    // issued it — stamping the issuer would make every card without a named
    // recipient redeemable only by that admin. When a recipient email is given,
    // resolve it so the card appears in their "My Gift Cards" list; otherwise
    // the card is a bearer instrument and gets claimed on first redemption.
    let ownerId: string | null = null;
    if (dto.issuedToEmail) {
      const recipient = await this.prisma.user.findUnique({
        where: { email: dto.issuedToEmail.trim().toLowerCase() },
        select: { id: true },
      });
      ownerId = recipient?.id ?? null;
    }

    const giftCard = await (this.prisma as any).giftCard.create({
      data: {
        code: code!,
        userId: ownerId,
        type: dto.type,
        amount: dto.amount,
        balance: dto.amount,
        currency: dto.currency || (await this.defaultCurrency()),
        status: 'ACTIVE',
        issuedToEmail: dto.issuedToEmail,
        issuedToName: dto.issuedToName,
        expiresAt,
        message: dto.message,
      },
    });

    // Create initial transaction record. The issuer is recorded here rather
    // than on the card, whose userId now means "assigned holder".
    await (this.prisma as any).giftCardTransaction.create({
      data: {
        giftCardId: giftCard.id,
        type: 'PURCHASE',
        amount: dto.amount,
        balanceAfter: dto.amount,
        notes: `Gift card purchased (issued by ${userId})`,
      },
    });

    return giftCard;
  }

  /**
   * Validate gift card code.
   *
   * @param userId Caller, when the request carried a session. Checkout applies
   * a card here and only redeems it at payment, so the assignment check runs at
   * both points — otherwise the customer is told the card is fine and only
   * discovers it is not theirs after entering payment details. Guests skip the
   * check because there is no identity to compare against; redeem still enforces it.
   */
  async validate(code: string, userId?: string): Promise<any> {
    const normalized = this.parseGiftCardCode(code);
    const giftCard = await (this.prisma as any).giftCard.findUnique({
      where: { code: normalized },
    });

    if (!giftCard) {
      throw new BadRequestException('Invalid or inactive gift card');
    }

    if (userId) {
      await this.assertRedeemerOwnsCard(this.prisma, giftCard, userId);
    }

    // Check if expired — settle the stored status here too, so a card the
    // customer was just told is expired stops showing as ACTIVE to the admin.
    if (giftCard.status === 'EXPIRED' || this.isExpired(giftCard)) {
      await this.settleExpiredStatus(giftCard);
      throw new BadRequestException('Gift card has expired');
    }

    // Check if already fully redeemed
    if (giftCard.status === 'REDEEMED' || Number(giftCard.balance) <= 0) {
      throw new BadRequestException('Gift card has no remaining balance');
    }

    // Check if cancelled
    if (giftCard.status === 'CANCELLED') {
      throw new BadRequestException('Gift card has been cancelled');
    }

    // Only fully-activated (paid) cards are usable. PENDING/INACTIVE cards await payment.
    if (giftCard.status !== 'ACTIVE') {
      throw new BadRequestException('Gift card is not active');
    }

    return {
      valid: true,
      balance: Number(giftCard.balance),
      currency: giftCard.currency,
      expiresAt: giftCard.expiresAt,
    };
  }

  /**
   * Redeem gift card (apply to order)
   */
  async redeem(userId: string, dto: RedeemGiftCardDto): Promise<any> {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Redemption amount must be greater than zero');
    }

    const normalizedCode = this.parseGiftCardCode(dto.code);

    // Use transaction with Serializable isolation to prevent race conditions on balance
    return this.prisma.$transaction(
      async (tx) => {
        const giftCard = await (tx as any).giftCard.findUnique({
          where: { code: normalizedCode },
        });

        if (!giftCard) {
          throw new NotFoundException('Gift card not found');
        }

        // A card issued to a named recipient belongs to that person; knowing the
        // code is not authorization to spend someone else's balance.
        await this.assertRedeemerOwnsCard(tx, giftCard, userId);

        if (giftCard.status === 'EXPIRED' || this.isExpired(giftCard)) {
          throw new BadRequestException('Gift card has expired');
        }

        if (giftCard.status === 'REDEEMED' || Number(giftCard.balance) <= 0) {
          throw new BadRequestException('Gift card has no remaining balance');
        }

        if (giftCard.status === 'CANCELLED') {
          throw new BadRequestException('Gift card has been cancelled');
        }

        // Only fully-activated (paid) cards are redeemable.
        if (giftCard.status !== 'ACTIVE') {
          throw new BadRequestException('Gift card is not active');
        }

        const currentBalance = Number(giftCard.balance);
        const redeemAmount = dto.amount;

        if (redeemAmount > currentBalance) {
          throw new BadRequestException(`Insufficient balance. Available: ${currentBalance}`);
        }

        // Cap total redemptions for an order to that order's outstanding total, and verify
        // the order belongs to the redeeming user.
        if (dto.orderId) {
          const order = await (tx as any).order.findUnique({
            where: { id: dto.orderId },
            select: { id: true, userId: true, total: true, paymentStatus: true },
          });
          if (!order) {
            throw new NotFoundException('Order not found');
          }
          if (order.userId && order.userId !== userId) {
            throw new ForbiddenException('You do not own this order');
          }
          if (order.paymentStatus && order.paymentStatus !== 'PENDING') {
            throw new BadRequestException('Order is not awaiting payment');
          }
          const priorRedemptions = await (tx as any).giftCardTransaction.aggregate({
            where: { orderId: dto.orderId, type: 'REDEMPTION' },
            _sum: { amount: true },
          });
          const alreadyRedeemed = Number(priorRedemptions?._sum?.amount ?? 0);
          if (alreadyRedeemed + redeemAmount > Number(order.total)) {
            throw new BadRequestException(
              'Redemption exceeds the order total already covered by gift cards',
            );
          }
        }

        const newBalance = currentBalance - redeemAmount;

        const updatedGiftCard = await tx.giftCard.update({
          where: { id: giftCard.id },
          data: {
            balance: newBalance,
            status: newBalance <= 0 ? 'REDEEMED' : 'ACTIVE',
            redeemedAt: newBalance <= 0 ? new Date() : giftCard.redeemedAt,
            userId: giftCard.userId || userId,
          },
        });

        await (tx as any).giftCardTransaction.create({
          data: {
            giftCardId: giftCard.id,
            orderId: dto.orderId,
            type: 'REDEMPTION',
            amount: redeemAmount,
            balanceAfter: newBalance,
            notes: dto.orderId ? `Redeemed for order ${dto.orderId}` : 'Redeemed',
          },
        });

        return updatedGiftCard;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Get user's gift cards — owned directly OR issued to their email.
   */
  async getMyGiftCards(userId: string, page = 1, limit = 20, email?: string) {
    const skip = (page - 1) * limit;

    const conditions: any[] = [{ userId }];
    if (email) {
      conditions.push({ issuedToEmail: { equals: email, mode: 'insensitive' } });
    }
    const where = conditions.length === 1 ? conditions[0] : { OR: conditions };

    const [giftCards, total] = await Promise.all([
      (this.prisma as any).giftCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      (this.prisma as any).giftCard.count({ where }),
    ]);

    return {
      items: giftCards.map((gc) =>
        this.withEffectiveStatus({
          id: gc.id,
          code: gc.code,
          type: gc.type,
          amount: gc.amount,
          balance: gc.balance,
          currency: gc.currency,
          status: gc.status,
          expiresAt: gc.expiresAt,
          purchasedAt: gc.purchasedAt,
          redeemedAt: gc.redeemedAt,
          recentTransactions: gc.transactions,
        }),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List all gift cards (admin)
   */
  async listAll(page = 1, limit = 20, status?: string, type?: string) {
    // Settle any overdue cards first so the filter and the badges below agree
    // with the stored status instead of drifting until the next sweep.
    await this.expireOverdueGiftCards().catch(() => undefined);

    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      (this.prisma as any).giftCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { transactions: true } },
        },
      }),
      (this.prisma as any).giftCard.count({ where }),
    ]);

    return {
      items: items.map((gc: any) =>
        this.withEffectiveStatus({
          ...gc,
          transactionCount: gc._count?.transactions ?? 0,
          _count: undefined,
        }),
      ),
      pagination: { page, limit, total },
    };
  }

  /**
   * Get gift card transactions
   */
  async getTransactions(
    giftCardId: string,
    userId: string,
    opts?: { isAdmin?: boolean },
  ): Promise<any[]> {
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { id: giftCardId },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    if (!opts?.isAdmin && giftCard.userId !== userId) {
      throw new ForbiddenException('You do not have access to this gift card');
    }

    const transactions = await (this.prisma as any).giftCardTransaction.findMany({
      where: { giftCardId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }

  /**
   * Refund gift card (restore balance)
   */
  async refund(giftCardId: string, orderId: string, amount: number): Promise<any> {
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const giftCard = await tx.giftCard.findUnique({
          where: { id: giftCardId },
        });

        if (!giftCard) {
          throw new NotFoundException('Gift card not found');
        }

        // A card can be redeemed against the same order more than once (top-ups at
        // checkout), so the refundable amount is every redemption on that pair.
        const redemptions = await (tx as any).giftCardTransaction.aggregate({
          where: { giftCardId, orderId, type: 'REDEMPTION' },
          _sum: { amount: true },
          _count: { _all: true },
        });

        if (!redemptions?._count?._all) {
          throw new BadRequestException('This gift card was not used for the specified order');
        }

        const existingRefunds = await (tx as any).giftCardTransaction.aggregate({
          where: { giftCardId, orderId, type: 'REFUND' },
          _sum: { amount: true },
        });
        const alreadyRefunded = Number(existingRefunds._sum?.amount || 0);
        const maxRefund = Number(redemptions._sum?.amount || 0) - alreadyRefunded;

        if (amount > maxRefund) {
          throw new BadRequestException(
            `Refund amount ($${amount}) exceeds refundable amount ($${maxRefund})`,
          );
        }

        const currentBalance = Number(giftCard.balance);
        const originalAmount = Number(giftCard.amount);
        const newBalance = Math.min(currentBalance + amount, originalAmount);

        // Returning funds must not resurrect a card the clock has already
        // retired, or a cancelled one.
        const restoredStatus =
          giftCard.status === 'CANCELLED' || this.isExpired(giftCard)
            ? giftCard.status === 'CANCELLED'
              ? 'CANCELLED'
              : 'EXPIRED'
            : 'ACTIVE';

        const updatedGiftCard = await tx.giftCard.update({
          where: { id: giftCardId },
          data: {
            balance: newBalance,
            status: restoredStatus,
            redeemedAt: null,
          },
        });

        await (tx as any).giftCardTransaction.create({
          data: {
            giftCardId,
            orderId,
            type: 'REFUND',
            amount,
            balanceAfter: newBalance,
            notes: `Refund for order ${orderId}`,
          },
        });

        return updatedGiftCard;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
