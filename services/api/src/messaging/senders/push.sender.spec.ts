import { PushSender } from './push.sender';

describe('PushSender', () => {
  it('succeeds with no subscriptions (no-op)', async () => {
    const prisma = {
      pushSubscription: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const config = { get: jest.fn() };
    const sender = new PushSender(prisma as any, config as any);
    const r = await sender.send({ userId: 'u1', to: 'u1', body: 'Hi', subject: 'T' });
    expect(r.success).toBe(true);
    expect(r.providerRef).toMatch(/skipped-no-subscription/);
  });

  it('skips when VAPID keys missing', async () => {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([{ id: 's1', endpoint: 'https://x', keys: {} }]),
      },
    };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const sender = new PushSender(prisma as any, config as any);
    const r = await sender.send({ userId: 'u1', to: 'u1', body: 'Hi' });
    expect(r.success).toBe(true);
    expect(r.providerRef).toMatch(/skipped-no-vapid/);
  });
});
