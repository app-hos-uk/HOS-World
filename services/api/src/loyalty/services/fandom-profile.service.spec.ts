import { FandomProfileService } from './fandom-profile.service';

describe('FandomProfileService', () => {
  it('normalizes scores to 0–1', async () => {
    const queryRawResults = [
      [{ fandom: 'Harry Potter', score: 8 }],
      [{ fandom: 'Anime', score: 1.5 }],
      [],
      [],
    ];
    let callIdx = 0;
    const prisma: any = {
      $queryRaw: jest.fn().mockImplementation(() => Promise.resolve(queryRawResults[callIdx++] ?? [])),
      user: {
        findUnique: jest.fn().mockResolvedValue({ favoriteFandoms: ['DC'] }),
      },
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
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findUnique: jest.fn().mockResolvedValue({ favoriteFandoms: [] }) },
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
