import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LoyaltyReferralService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async ensureReferralCode(membershipId: string, firstName?: string | null): Promise<string> {
    const existing = await this.prisma.loyaltyReferral.findFirst({
      where: { referrerId: membershipId, status: 'PENDING', refereeId: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing.referralCode;

    const brand = this.config.get<string>('LOYALTY_CARD_PREFIX', 'HOS');
    const prefix = (firstName || 'FRIEND').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase() || 'FRIEND';
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    const code = `${brand}-${prefix}-${suffix}`;

    await this.prisma.loyaltyReferral.create({
      data: {
        referrerId: membershipId,
        referralCode: code,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    return code;
  }
}
