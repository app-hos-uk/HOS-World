import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SellerType, UserRole, VendorStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';

const PLATFORM_RETAIL_EMAIL = 'platform-retail@houseofspells.internal';
const PLATFORM_RETAIL_SLUG = 'house-of-spells-official';

/**
 * Resolves the platform retail seller used for HOS outlet POS / loyalty.
 * Order: HOS_SELLER_ID env → existing PLATFORM_RETAIL → create (race-safe).
 */
@Injectable()
export class PlatformSellerService {
  private readonly logger = new Logger(PlatformSellerService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async resolvePlatformRetailSellerId(): Promise<string> {
    const envId = (this.config.get<string>('HOS_SELLER_ID') || '').trim();
    if (envId) {
      const fromEnv = await this.prisma.seller.findUnique({ where: { id: envId } });
      if (fromEnv?.sellerType === SellerType.PLATFORM_RETAIL) {
        return fromEnv.id;
      }
      this.logger.warn(
        `HOS_SELLER_ID=${envId} is missing or not PLATFORM_RETAIL; falling back to lookup/create`,
      );
    }

    const existing = await this.prisma.seller.findFirst({
      where: { sellerType: SellerType.PLATFORM_RETAIL },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing.id;

    return this.createPlatformRetailSeller();
  }

  private async createPlatformRetailSeller(): Promise<string> {
    let user = await this.prisma.user.findUnique({ where: { email: PLATFORM_RETAIL_EMAIL } });
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            email: PLATFORM_RETAIL_EMAIL,
            password: randomBytes(16).toString('hex'),
            firstName: 'House',
            lastName: 'Platform',
            role: UserRole.B2C_SELLER,
            country: 'US',
            currencyPreference: 'USD',
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          user = await this.prisma.user.findUnique({ where: { email: PLATFORM_RETAIL_EMAIL } });
        } else {
          throw e;
        }
      }
    }
    if (!user) {
      throw new Error('Failed to resolve platform retail user');
    }

    const byUser = await this.prisma.seller.findUnique({ where: { userId: user.id } });
    if (byUser) {
      if (byUser.sellerType !== SellerType.PLATFORM_RETAIL) {
        return (
          await this.prisma.seller.update({
            where: { id: byUser.id },
            data: {
              sellerType: SellerType.PLATFORM_RETAIL,
              verified: true,
              vendorStatus: VendorStatus.APPROVED,
              loyaltyEnabled: true,
              loyaltyFundingModel: 'PLATFORM_FUNDED',
              commissionRate: 0,
            },
          })
        ).id;
      }
      return byUser.id;
    }

    try {
      const seller = await this.prisma.seller.create({
        data: {
          userId: user.id,
          storeName: 'House of Spells Official',
          slug: PLATFORM_RETAIL_SLUG,
          country: 'GB',
          sellerType: SellerType.PLATFORM_RETAIL,
          verified: true,
          vendorStatus: VendorStatus.APPROVED,
          loyaltyEnabled: true,
          loyaltyFundingModel: 'PLATFORM_FUNDED',
          commissionRate: 0,
        },
      });
      this.logger.log(`Created PLATFORM_RETAIL seller ${seller.id}`);
      return seller.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const raced =
          (await this.prisma.seller.findUnique({ where: { userId: user.id } })) ||
          (await this.prisma.seller.findUnique({ where: { slug: PLATFORM_RETAIL_SLUG } })) ||
          (await this.prisma.seller.findFirst({
            where: { sellerType: SellerType.PLATFORM_RETAIL },
          }));
        if (raced) return raced.id;
      }
      throw e;
    }
  }
}
