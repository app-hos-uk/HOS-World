import { WhatsAppSender } from './whatsapp.sender';

describe('WhatsAppSender', () => {
  it('delegates to WhatsAppService.sendMessage', async () => {
    const wa = {
      sendMessage: jest.fn().mockResolvedValue({ status: 'SENT', messageId: 'mid' }),
    };
    const sender = new WhatsAppSender(wa as any);
    const r = await sender.send({
      userId: 'u1',
      to: '+441',
      body: 'Hello',
    });
    expect(wa.sendMessage).toHaveBeenCalled();
    expect(r.success).toBe(true);
  });

  it('marks failure when status FAILED', async () => {
    const wa = {
      sendMessage: jest.fn().mockResolvedValue({ status: 'FAILED' }),
    };
    const sender = new WhatsAppSender(wa as any);
    const r = await sender.send({ userId: 'u1', to: '+441', body: 'x' });
    expect(r.success).toBe(false);
  });

  it('returns error on exception', async () => {
    const wa = { sendMessage: jest.fn().mockRejectedValue(new Error('twilio')) };
    const sender = new WhatsAppSender(wa as any);
    const r = await sender.send({ userId: 'u1', to: '+441', body: 'x' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('twilio');
  });
});
