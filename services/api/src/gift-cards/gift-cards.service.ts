import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  NotImplementedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
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
        currency: dto.currency || 'GBP',
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
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
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
      owner: giftCard.user,
    };
  }

  /**
   * Redeem gift card (apply to order)
   */
  async redeem(userId: string, dto: RedeemGiftCardDto): Promise<any> {
    // Validate gift card
    const giftCard = await (this.prisma as any).giftCard.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    // Check if user owns the gift card or if it's unassigned
    if (giftCard.userId && giftCard.userId !== userId) {
      throw new ForbiddenException('You do not own this gift card');
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

    const currentBalance = Number(giftCard.balance);
    const redeemAmount = dto.amount;

    if (redeemAmount > currentBalance) {
      throw new BadRequestException(`Insufficient balance. Available: ${currentBalance}`);
    }

    // Calculate new balance
    const newBalance = currentBalance - redeemAmount;

    // Update gift card
    const updatedGiftCard = await this.prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        balance: newBalance,
        status: newBalance <= 0 ? 'REDEEMED' : 'ACTIVE',
        redeemedAt: newBalance <= 0 ? new Date() : giftCard.redeemedAt,
        userId: giftCard.userId || userId, // Assign to user if not already assigned
      },
    });

    // Create transaction record
    await (this.prisma as any).giftCardTransaction.create({
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
  }

  /**
   * Get user's gift cards
   */
  async getMyGiftCards(userId: string): Promise<any[]> {
    const giftCards = await (this.prisma as any).giftCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Last 5 transactions
        },
      },
    });

    return giftCards.map((gc) => ({
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
    }));
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
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { id: giftCardId },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    // Verify the order exists and used this gift card
    const transaction = await (this.prisma as any).giftCardTransaction.findFirst({
      where: {
        giftCardId,
        orderId,
        type: 'REDEMPTION',
      },
    });

    if (!transaction) {
      throw new BadRequestException('This gift card was not used for the specified order');
    }

    const currentBalance = Number(giftCard.balance);
    const newBalance = currentBalance + amount;

    // Update gift card
    const updatedGiftCard = await this.prisma.giftCard.update({
      where: { id: giftCardId },
      data: {
        balance: newBalance,
        status: 'ACTIVE', // Reactivate if it was redeemed
        redeemedAt: null, // Clear redeemed date
      },
    });

    // Create refund transaction
    await (this.prisma as any).giftCardTransaction.create({
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
  }
}
