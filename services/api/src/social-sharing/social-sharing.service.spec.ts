import { NotFoundException } from '@nestjs/common';
import { SocialSharingService } from './social-sharing.service';

describe('SocialSharingService.trackShareView', () => {
  const prisma = { sharedItem: { update: jest.fn() } };
  const service = new SocialSharingService(prisma as any, {} as any);

  beforeEach(() => jest.clearAllMocks());

  it('increments the view counter for a share that exists', async () => {
    prisma.sharedItem.update.mockResolvedValue({ id: 'share-1', views: 4 });

    await service.trackShareView('share-1');

    expect(prisma.sharedItem.update).toHaveBeenCalledWith({
      where: { id: 'share-1' },
      data: { views: { increment: 1 } },
    });
  });

  it('reports a missing share as 404 rather than a server error', async () => {
    prisma.sharedItem.update.mockRejectedValue(
      Object.assign(new Error('Record to update not found'), { code: 'P2025' }),
    );

    await expect(service.trackShareView('gone')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not disguise other database failures as a missing share', async () => {
    prisma.sharedItem.update.mockRejectedValue(
      Object.assign(new Error('connection lost'), { code: 'P1001' }),
    );

    await expect(service.trackShareView('share-1')).rejects.toThrow('connection lost');
  });
});
