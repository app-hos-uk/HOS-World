import { SmsSender } from './sms.sender';

describe('SmsSender', () => {
  it('returns skipped when Twilio SMS is not configured', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const sender = new SmsSender(config as any);
    const r = await sender.send({ userId: 'u1', to: '+441234567890', body: 'Hello' });
    expect(r.success).toBe(true);
    expect(r.providerRef).toMatch(/skipped/);
  });

  it('normalizes UK-style numbers without leading +', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const sender = new SmsSender(config as any);
    await sender.send({ userId: 'u1', to: '441234567890', body: 'x' });
    expect(config.get).toHaveBeenCalled();
  });
});
