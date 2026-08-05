import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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

describe('LoyaltyService', () => {
  let service: LoyaltyService;

  const mockFeatureFlags = {
    isEnabled: jest.fn().mockReturnValue(true),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'LOYALTY_ENABLED') return 'true';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: { loyaltyRedemptionOption: { findMany: jest.fn().mockResolvedValue([]) } } },
        { provide: ConfigService, useValue: mockConfig },
        { provide: FeatureFlagsService, useValue: mockFeatureFlags },
        { provide: LoyaltyBurnEngine, useValue: {} },
        { provide: LoyaltyEarnEngine, useValue: {} },
        { provide: LoyaltyTierEngine, useValue: {} },
        { provide: LoyaltyWalletService, useValue: {} },
        { provide: LoyaltyReferralService, useValue: {} },
        { provide: LoyaltyEventService, useValue: {} },
        { provide: QueueService, useValue: {} },
        { provide: LoyaltyListener, useValue: {} },
      ],
    }).compile();

    service = module.get(LoyaltyService);
    jest.clearAllMocks();
    mockFeatureFlags.isEnabled.mockReturnValue(true);
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'LOYALTY_ENABLED') return 'true';
      return undefined;
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
});
