import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateGiftCardDto } from './dto/create-gift-card.dto';
import { RedeemGiftCardDto } from './dto/redeem-gift-card.dto';

@Injectable()
export class GiftCardsService {
  constructor(private prisma: PrismaService) {}

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
    let code = this.generateCode();
    let exists = await this.prisma.giftCard.findUnique({ where: { code } });
    while (exists) {
      code = this.generateCode();
      exists = await this.prisma.giftCard.findUnique({ where: { code } });
    }

    const giftCard = await this.prisma.giftCard.create({
      data: {
        code,
        type: dto.type,
        amount: dto.amount,
        currency: dto.currency || 'USD',
        balance: dto.amount,
        status: 'active',
        issuedToEmail: dto.issuedToEmail,
        issuedToName: dto.issuedToName,
        purchasedByUserId: userId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        message: dto.message,
      },
    });

    return giftCard;
  }

  /**
   * Validate gift card code
   */
  async validate(code: string): Promise<any> {
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    if (giftCard.status !== 'active') {
      throw new BadRequestException(`Gift card is ${giftCard.status}`);
    }

    if (giftCard.balance <= 0) {
      throw new BadRequestException('Gift card has no balance');
    }

    if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) {
      throw new BadRequestException('Gift card has expired');
    }

    return {
      valid: true,
      code: giftCard.code,
      balance: giftCard.balance,
      currency: giftCard.currency,
      expiresAt: giftCard.expiresAt,
    };
  }

  /**
   * Redeem gift card (apply to order)
   */
  async redeem(userId: string, dto: RedeemGiftCardDto): Promise<any> {
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (!giftCard) {
      throw new NotFoundException('Gift card not found');
    }

    if (giftCard.status !== 'active') {
      throw new BadRequestException(`Gift card is ${giftCard.status}`);
    }

    if (giftCard.balance < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Update balance
    const balanceBefore = giftCard.balance;
    const balanceAfter = balanceBefore - dto.amount;

    const updated = await this.prisma.giftCard.update({
      where: { code: giftCard.code },
      data: {
        balance: balanceAfter,
        redeemedByUserId: userId,
        redeemedAt: dto.orderId ? new Date() : null,
        status: balanceAfter === 0 ? 'redeemed' : 'active',
      },
    });

    // Create transaction record if order exists
    if (dto.orderId) {
      await this.prisma.giftCardTransaction.create({
        data: {
          giftCardId: giftCard.id,
          orderId: dto.orderId,
          amount: dto.amount,
          balanceBefore,
          balanceAfter,
          type: 'redeemed',
        },
      });
    }

    return updated;
  }

  /**
   * Get user's gift cards
   */
  async getMyGiftCards(userId: string): Promise<any[]> {
    return this.prisma.giftCard.findMany({
      where: {
        OR: [
          { purchasedByUserId: userId },
          { redeemedByUserId: userId },
        ],
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Get gift card transactions
   */
  async getTransactions(giftCardId: string, userId: string): Promise<any[]> {
    const giftCard = await this.prisma.giftCard.findFirst({
      where: {
        id: giftCardId,
        OR: [
          { purchasedByUserId: userId },
          { redeemedByUserId: userId },
        ],
      },
    });

    if (!giftCard) {
      throw new ForbiddenException('Gift card not found');
    }

    return this.prisma.giftCardTransaction.findMany({
      where: { giftCardId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
      },
    });
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

    const balanceBefore = giftCard.balance;
    const balanceAfter = balanceBefore + amount;

    const updated = await this.prisma.giftCard.update({
      where: { id: giftCardId },
      data: {
        balance: balanceAfter,
        status: balanceAfter > 0 ? 'active' : giftCard.status,
      },
    });

    // Create refund transaction
    await this.prisma.giftCardTransaction.create({
      data: {
        giftCardId,
        orderId,
        amount,
        balanceBefore,
        balanceAfter,
        type: 'refunded',
      },
    });

    return updated;
  }
}

