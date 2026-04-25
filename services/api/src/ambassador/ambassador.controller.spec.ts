import { Test } from '@nestjs/testing';
import { AmbassadorController } from './ambassador.controller';
import { AmbassadorService } from './ambassador.service';

describe('AmbassadorController', () => {
  let controller: AmbassadorController;
  const ambassador = {
    eligibility: jest.fn().mockResolvedValue({ eligible: true }),
    enroll: jest.fn().mockResolvedValue({ id: 'a1' }),
    getProfile: jest.fn().mockResolvedValue({ id: 'a1' }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'a1' }),
    submitUgc: jest.fn().mockResolvedValue({ id: 'u1' }),
    listOwnUgc: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getReferralDashboard: jest.fn().mockResolvedValue({}),
    getLeaderboard: jest.fn().mockResolvedValue([]),
    listAchievements: jest.fn().mockResolvedValue([]),
    convertCommissionToPoints: jest.fn().mockResolvedValue({ pointsAwarded: 100 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AmbassadorController],
      providers: [{ provide: AmbassadorService, useValue: ambassador }],
    }).compile();
    controller = moduleRef.get(AmbassadorController);
  });

  it('GET eligibility', async () => {
    const r = await controller.eligibility({ user: { id: 'u1' } } as any);
    expect(ambassador.eligibility).toHaveBeenCalledWith('u1');
    expect(r.data).toEqual({ eligible: true });
  });

  it('POST enroll', async () => {
    await controller.enroll({ user: { id: 'u1' } } as any, {
      displayName: 'Test',
    } as any);
    expect(ambassador.enroll).toHaveBeenCalled();
  });

  it('GET profile', async () => {
    await controller.profile({ user: { id: 'u1' } } as any);
    expect(ambassador.getProfile).toHaveBeenCalledWith('u1');
  });

  it('POST ugc', async () => {
    await controller.submitUgc({ user: { id: 'u1' } } as any, { type: 'PHOTO' } as any);
    expect(ambassador.submitUgc).toHaveBeenCalled();
  });

  it('GET dashboard', async () => {
    await controller.dashboard({ user: { id: 'u1' } } as any);
    expect(ambassador.getReferralDashboard).toHaveBeenCalledWith('u1');
  });
});
