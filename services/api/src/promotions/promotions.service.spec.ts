import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PromotionStatus, PromotionType } from '@prisma/client';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';

/**
 * Covers the guards that keep a single-owner promotion (loyalty reward coupons are
 * minted this way) from leaking to other shoppers.
 */
describe('PromotionsService — single-owner coupons', () => {
  let service: PromotionsService;

  const mockPrisma = {
    coupon: { findUnique: jest.fn() },
    promotion: { findMany: jest.fn() },
    couponUsage: { count: jest.fn() },
    promotionUsage: { groupBy: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const loyaltyPromotion = {
    id: 'promo-loyalty',
    name: 'Loyalty reward HOS-LYL-ABCD1234',
    type: PromotionType.FIXED_DISCOUNT,
    status: PromotionStatus.ACTIVE,
    priority: 0,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 60_000),
    conditions: { allowedUserId: 'user-owner' },
    actions: { fixedAmount: 5 },
    isStackable: false,
    usageLimit: 1,
    usageCount: 0,
    userUsageLimit: 1,
    sellerId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
    mockCache.get.mockResolvedValue(null);
    mockPrisma.couponUsage.count.mockResolvedValue(0);
    mockPrisma.promotionUsage.groupBy.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ customerGroupId: null });
  });

  it('refuses a coupon that belongs to another account', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'coupon-1',
      code: 'HOS-LYL-ABCD1234',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 60_000),
      usageLimit: 1,
      usageCount: 0,
      userLimit: 1,
      promotion: loyaltyPromotion,
    });

    await expect(service.validateCoupon('HOS-LYL-ABCD1234', 'user-thief', 50, [])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accepts the coupon for the member who redeemed it', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'coupon-1',
      code: 'HOS-LYL-ABCD1234',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 60_000),
      usageLimit: 1,
      usageCount: 0,
      userLimit: 1,
      promotion: loyaltyPromotion,
    });

    const result = await service.validateCoupon('HOS-LYL-ABCD1234', 'user-owner', 50, []);
    expect(Number(result.discount)).toBe(5);
  });

  it('never applies a coupon-gated promotion automatically', async () => {
    mockPrisma.promotion.findMany.mockResolvedValue([
      { ...loyaltyPromotion, coupons: [{ id: 'coupon-1' }], _count: { coupons: 1 } },
    ]);

    const result = await service.applyPromotionsToCart('cart-1', 'user-owner', [
      { productId: 'p1', price: 50, quantity: 1 },
    ]);

    expect(result.discount).toBe(0);
    expect(result.appliedPromotions).toHaveLength(0);
  });

  it('still applies a public automatic promotion', async () => {
    mockPrisma.promotion.findMany.mockResolvedValue([
      {
        ...loyaltyPromotion,
        id: 'promo-public',
        conditions: {},
        coupons: [],
        _count: { coupons: 0 },
      },
    ]);

    const result = await service.applyPromotionsToCart('cart-1', 'user-anyone', [
      { productId: 'p1', price: 50, quantity: 1 },
    ]);

    expect(result.discount).toBe(5);
  });

  it('skips an owner-locked promotion for everyone else', async () => {
    mockPrisma.promotion.findMany.mockResolvedValue([
      { ...loyaltyPromotion, coupons: [], _count: { coupons: 0 } },
    ]);

    const others = await service.applyPromotionsToCart('cart-1', 'user-thief', [
      { productId: 'p1', price: 50, quantity: 1 },
    ]);
    expect(others.discount).toBe(0);
  });
});
