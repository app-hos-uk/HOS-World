import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../database/prisma.service';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { LoyaltyBurnEngine } from './engines/burn.engine';
import { LoyaltyEarnEngine } from './engines/earn.engine';
import { LoyaltyTierEngine } from './engines/tier.engine';
import { LoyaltyWalletService } from './services/wallet.service';
import { LoyaltyReferralService } from './services/referral.service';
import { LoyaltyEventService } from './services/loyalty-event.service';
import { QueueService } from '../queue/queue.service';
import { LoyaltyListener } from './listeners/loyalty.listener';
import { LoyaltySettingsService } from './services/loyalty-settings.service';

describe('LoyaltyService', () => {
  let service: LoyaltyService;

  const mockFeatureFlags = {
    isEnabled: jest.fn().mockReturnValue(true),
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultVal?: any) => {
      const map: Record<string, any> = {
        LOYALTY_ENABLED: 'true',
        LOYALTY_MIN_REDEMPTION_POINTS: 100,
        LOYALTY_CARD_PREFIX: 'HOS',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return map[key] ?? defaultVal;
    }),
  };

  const mockPrisma = {
    loyaltyRedemptionOption: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    loyaltyMembership: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    loyaltyTransaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    loyaltyTier: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    loyaltyEarnRule: {
      count: jest.fn(),
    },
    loyaltyBonusCampaign: {
      count: jest.fn(),
    },
    loyaltyReferral: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    cart: {
      update: jest.fn(),
    },
    gDPRConsentLog: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockBurn = {
    processRedemption: jest.fn(),
  };

  const mockEarn = {
    processOrderComplete: jest.fn(),
  };

  const mockTiers = {
    recalculateTier: jest.fn(),
  };

  const mockWallet = {
    applyDelta: jest.fn(),
    lockMembership: jest.fn().mockResolvedValue(undefined),
  };

  const mockReferrals = {
    ensureReferralCode: jest.fn(),
  };

  const mockEvents = {
    onWelcome: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueue = {
    addJob: jest.fn().mockResolvedValue(undefined),
  };

  const mockLoyaltyListener = {
    onProfileUpdated: jest.fn().mockResolvedValue(0),
    onUserRegistered: jest.fn().mockResolvedValue('applied'),
  };

  const mockLoyaltySettings = {
    getResolved: jest.fn().mockResolvedValue({
      settings: {
        defaultEarnRate: 1,
        defaultRedeemValue: 0.01,
        minRedemptionPoints: 100,
        cardPrefix: 'HOS',
        redemptionAtCheckout: true,
        posVoucherEnabled: false,
      },
      source: 'env',
    }),
    isCheckoutRedemptionEnabled: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: FeatureFlagsService, useValue: mockFeatureFlags },
        { provide: LoyaltyBurnEngine, useValue: mockBurn },
        { provide: LoyaltyEarnEngine, useValue: mockEarn },
        { provide: LoyaltyTierEngine, useValue: mockTiers },
        { provide: LoyaltyWalletService, useValue: mockWallet },
        { provide: LoyaltyReferralService, useValue: mockReferrals },
        { provide: LoyaltyEventService, useValue: mockEvents },
        { provide: QueueService, useValue: mockQueue },
        { provide: LoyaltyListener, useValue: mockLoyaltyListener },
        { provide: LoyaltySettingsService, useValue: mockLoyaltySettings },
      ],
    }).compile();

    service = module.get(LoyaltyService);
    jest.clearAllMocks();
    mockFeatureFlags.isEnabled.mockReturnValue(true);
    mockConfig.get.mockImplementation((key: string, defaultVal?: any) => {
      const map: Record<string, any> = {
        LOYALTY_ENABLED: 'true',
        LOYALTY_MIN_REDEMPTION_POINTS: 100,
        LOYALTY_CARD_PREFIX: 'HOS',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return map[key] ?? defaultVal;
    });
  });

  describe('assertEnabled', () => {
    it('passes when feature flag and env are enabled', () => {
      expect(() => service.assertEnabled()).not.toThrow();
    });

    it('throws when feature flag is disabled', () => {
      mockFeatureFlags.isEnabled.mockReturnValue(false);
      expect(() => service.assertEnabled()).toThrow(BadRequestException);
      expect(mockFeatureFlags.isEnabled).toHaveBeenCalledWith(FeatureFlag.LOYALTY_PROGRAMME);
    });

    it('throws when LOYALTY_ENABLED env is false', () => {
      mockConfig.get.mockReturnValue('false');
      expect(() => service.assertEnabled()).toThrow(BadRequestException);
    });
  });

  describe('isEnabled', () => {
    it('returns true when both flag and env are enabled', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false when feature flag is off', () => {
      mockFeatureFlags.isEnabled.mockReturnValue(false);
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('getTransactions', () => {
    it('throws NotFoundException when user is not enrolled', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      await expect(service.getTransactions('user-1', {})).rejects.toThrow(NotFoundException);
    });

    it('returns paginated transactions', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.loyaltyTransaction.findMany.mockResolvedValue([{ id: 'tx-1' }]);
      mockPrisma.loyaltyTransaction.count.mockResolvedValue(1);

      const result = await service.getTransactions('user-1', { page: 1, limit: 10 });
      expect(result).toEqual({ items: [{ id: 'tx-1' }], total: 1, page: 1, limit: 10 });
    });

    it('clamps page and limit to valid bounds', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.loyaltyTransaction.findMany.mockResolvedValue([]);
      mockPrisma.loyaltyTransaction.count.mockResolvedValue(0);

      const result = await service.getTransactions('user-1', { page: -1, limit: 500 });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
    });
  });

  describe('tierProgress', () => {
    it('returns unenrolled state when membership is missing', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      const result = await service.tierProgress('user-1');
      expect(result).toMatchObject({ enrolled: false, progressPercent: 0 });
    });

    it('returns 100% when at max tier', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        tier: { id: 'tier-3', name: 'Wizard', level: 3, pointsThreshold: 5000 },
        totalPointsEarned: 6000,
      });
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(null);

      const result = await service.tierProgress('user-1');
      expect(result.progressPercent).toBe(100);
      expect(result.pointsToNext).toBe(0);
    });

    it('calculates progress toward next tier', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        tier: { id: 'tier-1', name: 'Initiate', level: 1, pointsThreshold: 0 },
        totalPointsEarned: 250,
      });
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue({
        id: 'tier-2',
        name: 'Apprentice',
        level: 2,
        pointsThreshold: 500,
        isActive: true,
        inviteOnly: false,
      });

      const result = await service.tierProgress('user-1');
      expect(result.progressPercent).toBe(50);
      expect(result.pointsToNext).toBe(250);
    });
  });

  describe('getPreferences', () => {
    it('throws NotFoundException when not enrolled', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      await expect(service.getPreferences('user-1')).rejects.toThrow(NotFoundException);
    });

    it('returns preference fields', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({
        optInEmail: true,
        optInSms: false,
        optInWhatsApp: false,
        optInPush: true,
      });
      const result = await service.getPreferences('user-1');
      expect(result).toEqual({
        optInEmail: true,
        optInSms: false,
        optInWhatsApp: false,
        optInPush: true,
      });
    });
  });

  describe('updatePreferences', () => {
    it('throws NotFoundException when not enrolled', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePreferences('user-1', { optInEmail: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when no preferences are provided', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
      await expect(service.updatePreferences('user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('updates preferences and logs consent', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          loyaltyMembership: {
            update: jest.fn().mockResolvedValue({
              optInEmail: true,
              optInSms: false,
              optInWhatsApp: false,
              optInPush: false,
            }),
          },
          gDPRConsentLog: { createMany: jest.fn() },
        });
      });

      const result = await service.updatePreferences('user-1', { optInEmail: true });
      expect(result.optInEmail).toBe(true);
    });
  });

  describe('redeem', () => {
    it('throws NotFoundException when membership is missing', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      await expect(
        service.redeem('user-1', { points: 100, channel: 'MARKETPLACE_CHECKOUT' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates to burn engine with correct params', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        regionCode: 'GB',
      });
      mockBurn.processRedemption.mockResolvedValue({ redemptionId: 'rdm-1' });

      const result = await service.redeem('user-1', {
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        optionId: 'opt-1',
      });

      expect(mockBurn.processRedemption).toHaveBeenCalledWith(
        expect.objectContaining({
          membershipId: 'mem-1',
          points: 500,
          channel: 'MARKETPLACE_CHECKOUT',
          optionId: 'opt-1',
          regionCode: 'GB',
        }),
      );
      expect(result.redemptionId).toBe('rdm-1');
    });
  });

  describe('processOrderComplete', () => {
    it('delegates to earn engine', async () => {
      mockEarn.processOrderComplete.mockResolvedValue(undefined);
      await service.processOrderComplete('order-1');
      expect(mockEarn.processOrderComplete).toHaveBeenCalledWith('order-1');
    });
  });

  describe('cardPayload', () => {
    it('throws NotFoundException when not enrolled', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      await expect(service.cardPayload('user-1')).rejects.toThrow(NotFoundException);
    });

    it('returns card number, tier, balance, and QR payload', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({
        cardNumber: 'HOS-ABCD1234-EF56',
        tier: { name: 'Apprentice' },
        currentBalance: 300,
      });

      const result = await service.cardPayload('user-1');
      expect(result.cardNumber).toBe('HOS-ABCD1234-EF56');
      expect(result.tier).toBe('Apprentice');
      expect(result.balance).toBe(300);
      expect(JSON.parse(result.qrPayload)).toHaveProperty('t', 'hos-loyalty');
    });
  });

  describe('adminDashboard', () => {
    it('returns aggregated dashboard data', async () => {
      mockPrisma.loyaltyMembership.count.mockResolvedValue(50);
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([
        { name: 'Initiate', _count: { members: 40 } },
        { name: 'Apprentice', _count: { members: 10 } },
      ]);
      mockPrisma.loyaltyTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { points: 10000 } })
        .mockResolvedValueOnce({ _sum: { points: -2000 } });
      mockPrisma.loyaltyEarnRule.count.mockResolvedValue(5);
      mockPrisma.loyaltyRedemptionOption.findMany.mockResolvedValue([]);
      (mockPrisma as any).loyaltyRedemptionOption.count = jest.fn().mockResolvedValue(3);
      mockPrisma.loyaltyBonusCampaign.count.mockResolvedValue(2);
      mockPrisma.loyaltyMembership.aggregate.mockResolvedValue({
        _sum: { currentBalance: 8000 },
      });

      const result = await service.adminDashboard();
      expect(result.totalMembers).toBe(50);
      expect(result.pointsIssued).toBe(10000);
      expect(result.pointsRedeemed).toBe(2000);
      expect(result.totalPointsInCirculation).toBe(8000);
    });
  });

  describe('awardBonus', () => {
    it('does nothing when points is 0 or negative', async () => {
      await service.awardBonus('mem-1', 0, 'TEST', 'test');
      expect(mockPrisma.loyaltyMembership.findUnique).not.toHaveBeenCalled();
    });

    it('skips when membership does not exist', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue(null);
      await service.awardBonus('mem-1', 50, 'TEST', 'test');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('adminAdjustPoints', () => {
    const runTx = (membershipUpdate: jest.Mock, totalPointsEarned: number) => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          loyaltyMembership: {
            findUnique: jest.fn().mockResolvedValue({ totalPointsEarned }),
            update: membershipUpdate,
          },
        }),
      );
    };

    beforeEach(() => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-1', userId: 'user-1' });
      mockWallet.applyDelta.mockResolvedValue({ applied: true });
      mockTiers.recalculateTier.mockResolvedValue({ upgraded: false });
      // adminAdjustPoints returns getMembership(), which repairs bonuses; a
      // zero-point SIGNUP rule short-circuits that so this stays focused.
      (mockPrisma as any).loyaltyEarnRule.findFirst = jest
        .fn()
        .mockResolvedValue({ action: 'SIGNUP', isActive: true, pointsAmount: 0 });
      (mockPrisma as any).loyaltyTier.findFirst.mockResolvedValue({ id: 'tier-1' });
      mockLoyaltyListener.onProfileUpdated.mockResolvedValue(0);
    });

    it('raises the tier basis on a positive adjust', async () => {
      const membershipUpdate = jest.fn();
      runTx(membershipUpdate, 1000);

      await service.adminAdjustPoints('user-1', 250, 'goodwill');

      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalPointsEarned: { increment: 250 } } }),
      );
    });

    it('lowers the tier basis on a negative adjust so the tier can be corrected', async () => {
      const membershipUpdate = jest.fn();
      runTx(membershipUpdate, 1000);

      await service.adminAdjustPoints('user-1', -250, 'correction');

      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalPointsEarned: { decrement: 250 } } }),
      );
      expect(mockTiers.recalculateTier).toHaveBeenCalledWith('mem-1');
    });

    it('never drives the tier basis negative', async () => {
      const membershipUpdate = jest.fn();
      runTx(membershipUpdate, 100);

      await service.adminAdjustPoints('user-1', -500, 'correction');

      expect(membershipUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalPointsEarned: { decrement: 100 } } }),
      );
    });
  });

  describe('checkIn', () => {
    const runCheckIn = (checkInsToday: number) => {
      const membershipUpdate = jest.fn();
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({ id: 'mem-1' });
      (mockPrisma as any).loyaltyEarnRule.findFirst = jest
        .fn()
        .mockResolvedValue({ id: 'rule-1', action: 'CHECK_IN', pointsAmount: 15, maxPerDay: 1 });
      mockWallet.applyDelta.mockResolvedValue({ applied: true });
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          loyaltyTransaction: { count: jest.fn().mockResolvedValue(checkInsToday) },
          loyaltyMembership: { update: membershipUpdate },
        }),
      );
      return membershipUpdate;
    };

    it('awards with a per-store, per-day idempotency key', async () => {
      runCheckIn(0);

      const result = await service.checkIn('user-1', 'store-1');

      expect(result.pointsAwarded).toBe(15);
      expect(mockWallet.applyDelta).toHaveBeenCalledWith(
        expect.anything(),
        'mem-1',
        15,
        'EARN',
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(
            /^earn:CHECK_IN:mem-1:store-1:\d{4}-\d{2}-\d{2}:0$/,
          ),
        }),
      );
      expect(mockWallet.lockMembership).toHaveBeenCalled();
    });

    it('enforces the daily cap inside the transaction', async () => {
      const membershipUpdate = runCheckIn(1);

      await expect(service.checkIn('user-1', 'store-1')).rejects.toThrow(BadRequestException);
      expect(mockWallet.applyDelta).not.toHaveBeenCalled();
      expect(membershipUpdate).not.toHaveBeenCalled();
    });
  });

  describe('redeem', () => {
    it('forwards the caller idempotency key so a retry cannot burn twice', async () => {
      mockPrisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        regionCode: 'GB',
      });
      mockBurn.processRedemption.mockResolvedValue({ redemptionId: 'r1' });

      await service.redeem('user-1', {
        points: 500,
        channel: 'MARKETPLACE_CHECKOUT',
        idempotencyKey: 'client-attempt-1',
      });

      expect(mockBurn.processRedemption).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'client-attempt-1' }),
      );
    });
  });

  describe('lookupMember', () => {
    it('throws BadRequestException when no query provided', async () => {
      await expect(service.lookupMember({})).rejects.toThrow(BadRequestException);
    });

    it('finds member by card number', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        loyaltyMembership: { id: 'mem-1', tier: { name: 'Initiate' } },
      });

      const result = await service.lookupMember({ cardNumber: 'HOS-ABCD1234' });
      expect(result.userId).toBe('user-1');
    });

    it('throws NotFoundException when no match found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]);
      await expect(service.lookupMember({ email: 'nobody@test.com' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
