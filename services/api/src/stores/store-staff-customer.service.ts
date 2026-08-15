import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { normalizePhoneToE164 } from '../common/utils/phone-normalize';
import { lastInitial, maskCardNumber, maskEmail, maskPhoneLast4 } from '../common/utils/pii-mask';
import { PrismaService } from '../database/prisma.service';
import { StoreCustomerSearchDto, StoreCustomerSearchResult } from './dto/store-customer-search.dto';

const MAX_RESULTS = 10;

@Injectable()
export class StoreStaffCustomerService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  async search(
    dto: StoreCustomerSearchDto,
    opts: {
      staffUserId: string;
      storeId: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<StoreCustomerSearchResult[]> {
    const store = await this.prisma.store.findUnique({
      where: { id: opts.storeId },
      select: { id: true, country: true, countryCode: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    const countryHint = store.countryCode || store.country || undefined;
    const fieldType = this.resolveSearchField(dto);
    if (!fieldType) {
      throw new BadRequestException('At least one search field is required');
    }

    let results: StoreCustomerSearchResult[] = [];

    if (dto.cardNumber?.trim()) {
      results = await this.searchByCard(dto.cardNumber.trim());
    } else if (dto.email?.trim()) {
      results = await this.searchByEmail(dto.email.trim());
    } else if (dto.phone?.trim()) {
      results = await this.searchByPhone(dto.phone.trim(), countryHint);
    } else if (dto.phoneLastFour?.trim()) {
      results = await this.searchByPhoneLastFour(dto.phoneLastFour.trim());
    } else if (dto.name?.trim()) {
      results = await this.searchByName(dto.name.trim());
    }

    this.activity
      .createLog({
        userId: opts.staffUserId,
        action: 'STORE_CUSTOMER_SEARCH',
        entityType: 'LoyaltyMembership',
        description: `Store staff customer search (${fieldType})`,
        metadata: {
          storeId: opts.storeId,
          searchField: fieldType,
          resultCount: results.length,
        },
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      })
      .catch(() => undefined);

    return results;
  }

  private resolveSearchField(dto: StoreCustomerSearchDto): string | null {
    if (dto.cardNumber?.trim()) return 'cardNumber';
    if (dto.email?.trim()) return 'email';
    if (dto.phone?.trim()) return 'phone';
    if (dto.phoneLastFour?.trim()) return 'phoneLastFour';
    if (dto.name?.trim()) return 'name';
    return null;
  }

  /**
   * @param exactMatch true when the caller supplied a unique identifier (card,
   * email or full phone). Fuzzy searches get a masked card only, so staff must
   * confirm identity before they can redeem.
   */
  private toResult(
    row: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      phone: string | null;
      phoneNormalized: string | null;
      loyaltyMembership: {
        cardNumber: string | null;
        currentBalance: number;
        tier: { name: string } | null;
      } | null;
    },
    exactMatch: boolean,
  ): StoreCustomerSearchResult | null {
    if (!row.loyaltyMembership) return null;
    const card = row.loyaltyMembership.cardNumber;
    return {
      userId: row.id,
      firstName: row.firstName,
      lastInitial: lastInitial(row.lastName),
      maskedEmail: maskEmail(row.email),
      maskedPhone: maskPhoneLast4(row.phoneNormalized || row.phone),
      cardNumber: exactMatch ? card : null,
      maskedCardNumber: maskCardNumber(card),
      tierName: row.loyaltyMembership.tier?.name ?? null,
      currentBalance: row.loyaltyMembership.currentBalance,
    };
  }

  private memberInclude = {
    loyaltyMembership: {
      include: { tier: { select: { name: true } } },
    },
  } satisfies Prisma.UserInclude;

  private async searchByCard(cardNumber: string): Promise<StoreCustomerSearchResult[]> {
    const membership = await this.prisma.loyaltyMembership.findFirst({
      where: { cardNumber: { equals: cardNumber, mode: 'insensitive' } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            phoneNormalized: true,
          },
        },
        tier: { select: { name: true } },
      },
    });
    if (!membership?.user) return [];
    const r = this.toResult(
      {
        ...membership.user,
        loyaltyMembership: {
          cardNumber: membership.cardNumber,
          currentBalance: membership.currentBalance,
          tier: membership.tier,
        },
      },
      true,
    );
    return r ? [r] : [];
  }

  private async searchByEmail(email: string): Promise<StoreCustomerSearchResult[]> {
    const users = await this.prisma.user.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        loyaltyMembership: { isNot: null },
      },
      include: this.memberInclude,
      take: MAX_RESULTS,
    });
    return users
      .map((u) => this.toResult(u as any, true))
      .filter(Boolean) as StoreCustomerSearchResult[];
  }

  private async searchByPhone(
    phone: string,
    countryHint?: string,
  ): Promise<StoreCustomerSearchResult[]> {
    const phoneNormalized = normalizePhoneToE164(phone) ?? normalizePhoneToE164(phone, countryHint);
    if (!phoneNormalized) return [];
    const users = await this.prisma.user.findMany({
      where: {
        phoneNormalized,
        loyaltyMembership: { isNot: null },
      },
      include: this.memberInclude,
      take: MAX_RESULTS,
    });
    return users
      .map((u) => this.toResult(u as any, true))
      .filter(Boolean) as StoreCustomerSearchResult[];
  }

  private async searchByPhoneLastFour(lastFour: string): Promise<StoreCustomerSearchResult[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [{ phoneNormalized: { endsWith: lastFour } }, { phone: { endsWith: lastFour } }],
        loyaltyMembership: { isNot: null },
      },
      include: this.memberInclude,
      take: MAX_RESULTS,
    });
    return users
      .map((u) => this.toResult(u as any, false))
      .filter(Boolean) as StoreCustomerSearchResult[];
  }

  private async searchByName(name: string): Promise<StoreCustomerSearchResult[]> {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const where: Prisma.UserWhereInput = {
      loyaltyMembership: { isNot: null },
      OR: [
        { firstName: { contains: name, mode: 'insensitive' } },
        { lastName: { contains: name, mode: 'insensitive' } },
        ...(parts.length >= 2
          ? [
              {
                AND: [
                  { firstName: { contains: parts[0], mode: 'insensitive' as const } },
                  {
                    lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' as const },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const users = await this.prisma.user.findMany({
      where,
      include: this.memberInclude,
      take: MAX_RESULTS,
    });
    return users
      .map((u) => this.toResult(u as any, false))
      .filter(Boolean) as StoreCustomerSearchResult[];
  }
}
