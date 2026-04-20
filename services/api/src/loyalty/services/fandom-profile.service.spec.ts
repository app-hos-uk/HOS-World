import { FandomProfileService } from './fandom-profile.service';

describe('FandomProfileService', () => {
  it('normalizes scores to 0–1', async () => {
    const prisma: any = {
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          { product: { fandom: 'Harry Potter' } },
          { product: { fandom: 'Harry Potter' } },
        ]),
      },
      wishlistItem: {
        findMany: jest.fn().mockResolvedValue([{ product: { fandom: 'Anime' } }]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ favoriteFandoms: ['DC'] }),
      },
      fandomQuizAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      userQuest: { findMany: jest.fn().mockResolvedValue([]) },
      loyaltyMembership: { updateMany: jest.fn() },
    };
    const svc = new FandomProfileService(prisma);
    const profile = await svc.computeProfile('u1');
    expect(profile['Harry Potter']).toBe(1);
    expect(profile['Anime']).toBeLessThan(1);
    expect(profile['DC']).toBeLessThan(1);
  });

  it('updateMemberProfile writes JSON', async () => {
    const prisma: any = {
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      wishlistItem: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue({ favoriteFandoms: [] }) },
      fandomQuizAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      userQuest: { findMany: jest.fn().mockResolvedValue([]) },
      loyaltyMembership: { updateMany: jest.fn() },
    };
    const svc = new FandomProfileService(prisma);
    await svc.updateMemberProfile('u1');
    expect(prisma.loyaltyMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: expect.objectContaining({ fandomProfile: {} }),
      }),
    );
  });

  it('batchUpdateProfiles counts successes', async () => {
    const prisma: any = {
      loyaltyMembership: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'a' }, { userId: 'b' }]),
      },
    };
    const svc = new FandomProfileService(prisma);
    jest.spyOn(svc, 'updateMemberProfile').mockResolvedValue();
    const n = await svc.batchUpdateProfiles();
    expect(n).toBe(2);
  });
});
