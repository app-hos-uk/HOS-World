import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  NotImplementedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateGiftCardDto } from './dto/create-gift-card.dto';
import { RedeemGiftCardDto } from './dto/redeem-gift-card.dto';

@Injectable()
export class GiftCardsService {
  constructor(private prisma: PrismaService) {}

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

    // Create gift card
    const giftCard = await (this.prisma as any).giftCard.create({
      data: {
        code: code!,
        userId,
        type: dto.type,
        amount: dto.amount,
        balance: dto.amount, // Initial balance equals amount
        currency: dto.currency || 'USD',
        status: 'ACTIVE',
        issuedToEmail: dto.issuedToEmail,
        issuedToName: dto.issuedToName,
        expiresAt,
        message: dto.message,
      },
    });

    // Create initial transaction record
    await (this.prisma as any).giftCardTransaction.create({
      data: {
        giftCardId: giftCard.id,
        type: 'PURCHASE',
        amount: dto.amount,
        balanceAfter: dto.amount,
        notes: 'Gift card purchased',
      },
    });

    return giftCard;
  }

  /**
   * Validate gift card code
   */
  async validate(code: string): Promise<any> {
    const giftCard = await (this.prisma as any).giftCard.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    // Check if expired
    if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
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

    return {
      id: giftCard.id,
      code: giftCard.code,
      balance: giftCard.balance,
      currency: giftCard.currency,
      status: giftCard.status,
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

    // Use transaction with Serializable isolation to prevent race conditions on balance
    return this.prisma.$transaction(async (tx) => {
      const giftCard = await (tx as any).giftCard.findUnique({
        where: { code: dto.code.toUpperCase() },
      });

      if (!giftCard) {
        throw new NotFoundException('Gift card not found');
      }

      if (giftCard.userId && giftCard.userId !== userId) {
        throw new ForbiddenException('You do not own this gift card');
      }

      if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
        throw new BadRequestException('Gift card has expired');
      }

      if (giftCard.status === 'REDEEMED' || Number(giftCard.balance) <= 0) {
        throw new BadRequestException('Gift card has no remaining balance');
      }

      if (giftCard.status === 'CANCELLED') {
        throw new BadRequestException('Gift card has been cancelled');
      }

      const currentBalance = Number(giftCard.balance);
      const redeemAmount = dto.amount;

      if (redeemAmount > currentBalance) {
        throw new BadRequestException(`Insufficient balance. Available: ${currentBalance}`);
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Get user's gift cards
   */
  async getMyGiftCards(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [giftCards, total] = await Promise.all([
      (this.prisma as any).giftCard.findMany({
        where: { userId },
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
      (this.prisma as any).giftCard.count({ where: { userId } }),
    ]);

    return {
      items: giftCards.map((gc) => ({
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
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get gift card transactions
   */
  async getTransactions(giftCardId: string, userId: string): Promise<any[]> {
    // Verify user owns the gift card
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { id: giftCardId },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    if (giftCard.userId !== userId) {
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

    return this.prisma.$transaction(async (tx) => {
      const giftCard = await tx.giftCard.findUnique({
        where: { id: giftCardId },
      });

      if (!giftCard) {
        throw new NotFoundException('Gift card not found');
      }

      const transaction = await (tx as any).giftCardTransaction.findFirst({
        where: {
          giftCardId,
          orderId,
          type: 'REDEMPTION',
        },
      });

      if (!transaction) {
        throw new BadRequestException('This gift card was not used for the specified order');
      }

      const existingRefunds = await (tx as any).giftCardTransaction.aggregate({
        where: { giftCardId, orderId, type: 'REFUND' },
        _sum: { amount: true },
      });
      const alreadyRefunded = Number(existingRefunds._sum?.amount || 0);
      const maxRefund = Number(transaction.amount) - alreadyRefunded;

      if (amount > maxRefund) {
        throw new BadRequestException(
          `Refund amount ($${amount}) exceeds refundable amount ($${maxRefund})`,
        );
      }

      const currentBalance = Number(giftCard.balance);
      const originalAmount = Number(giftCard.amount);
      const newBalance = Math.min(currentBalance + amount, originalAmount);

      const updatedGiftCard = await tx.giftCard.update({
        where: { id: giftCardId },
        data: {
          balance: newBalance,
          status: 'ACTIVE',
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
