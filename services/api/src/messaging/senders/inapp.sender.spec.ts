import { InAppSender } from './inapp.sender';

describe('InAppSender', () => {
  it('creates notification row', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ email: 'a@b.c' }) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const sender = new InAppSender(prisma as any);
    const r = await sender.send({
      userId: 'u1',
      to: 'u1',
      subject: 'Subj',
      body: 'Content',
      templateSlug: 'inapp_x',
    });
    expect(r.success).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('returns error when prisma throws', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ email: null }) },
      notification: { create: jest.fn().mockRejectedValue(new Error('db')) },
    };
    const sender = new InAppSender(prisma as any);
    const r = await sender.send({ userId: 'u1', to: 'u1', body: 'x' });
    expect(r.success).toBe(false);
  });
});
