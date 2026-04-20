import { EmailSender } from './email.sender';

describe('EmailSender', () => {
  it('send queues notification and succeeds', async () => {
    const notifications = { queueNotification: jest.fn().mockResolvedValue(undefined) };
    const sender = new EmailSender(notifications as any);
    const r = await sender.send({
      userId: 'u1',
      to: 'a@b.c',
      subject: 'S',
      body: 'B',
    });
    expect(r.success).toBe(true);
    expect(notifications.queueNotification).toHaveBeenCalledWith('a@b.c', 'S', 'B');
  });

  it('send returns error when queue throws', async () => {
    const notifications = { queueNotification: jest.fn().mockRejectedValue(new Error('smtp')) };
    const sender = new EmailSender(notifications as any);
    const r = await sender.send({ userId: 'u1', to: 'a@b.c', subject: 'S', body: 'B' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('smtp');
  });

  it('uses default subject when omitted', async () => {
    const notifications = { queueNotification: jest.fn().mockResolvedValue(undefined) };
    const sender = new EmailSender(notifications as any);
    await sender.send({ userId: 'u1', to: 'a@b.c', body: 'B' });
    expect(notifications.queueNotification).toHaveBeenCalledWith('a@b.c', 'House of Spells', 'B');
  });
});
