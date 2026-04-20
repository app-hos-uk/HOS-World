import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  let service: MessagingService;
  let prisma: any;
  let templates: { render: jest.Mock };
  let emailSender: { send: jest.Mock };

  beforeEach(() => {
    templates = {
      render: jest.fn().mockResolvedValue({ subject: 'S', body: '<p>Hi</p>', channel: 'EMAIL' }),
    };
    emailSender = { send: jest.fn().mockResolvedValue({ success: true }) };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'a@b.c',
          phone: '+441',
          whatsappNumber: '+441',
          gdprConsent: true,
          dataProcessingConsent: { marketing: true },
          preferredCommunicationMethod: 'EMAIL',
        }),
      },
      loyaltyMembership: {
        findUnique: jest.fn().mockResolvedValue({
          optInEmail: true,
          optInSms: true,
          optInWhatsApp: true,
          optInPush: true,
        }),
      },
      newsletterSubscription: { findFirst: jest.fn().mockResolvedValue(null) },
      messageLog: {
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
        update: jest.fn(),
      },
    };
    const sms = { send: jest.fn() };
    const wa = { send: jest.fn() };
    const push = { send: jest.fn() };
    const inapp = { send: jest.fn() };
    const configService = { get: jest.fn().mockReturnValue('https://example.com') };
    const jwtService = { sign: jest.fn().mockReturnValue('tok123') };
    service = new MessagingService(
      prisma,
      templates as any,
      configService as any,
      jwtService as any,
      emailSender as any,
      sms as any,
      wa as any,
      push as any,
      inapp as any,
    );
  });

  it('send creates MessageLog and sends email when consent OK', async () => {
    const r = await service.send({
      userId: 'u1',
      channel: 'EMAIL',
      templateSlug: 'welcome_loyalty',
      templateVars: { firstName: 'X', tierName: 'T' },
    });
    expect(r.success).toBe(true);
    expect(prisma.messageLog.create).toHaveBeenCalled();
    expect(emailSender.send).toHaveBeenCalled();
  });

  it('send marks SKIPPED_CONSENT when marketing opted out', async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: 'a@b.c',
      gdprConsent: true,
      dataProcessingConsent: { marketing: false },
    });
    const r = await service.send({
      userId: 'u1',
      channel: 'EMAIL',
      templateSlug: 'welcome_loyalty',
      templateVars: { firstName: 'X', tierName: 'T' },
    });
    expect(r.success).toBe(false);
    expect(prisma.messageLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SKIPPED_CONSENT' }),
      }),
    );
  });

  it('sendMultiChannel fans out', async () => {
    const spy = jest.spyOn(service, 'send').mockResolvedValue({ success: true });
    await service.sendMultiChannel({
      userId: 'u1',
      channels: ['EMAIL', 'EMAIL'],
      templateSlug: 'welcome_loyalty',
      templateVars: { firstName: 'X', tierName: 'T' },
    });
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('canSendMarketing allows IN_APP without marketing consent', async () => {
    prisma.user.findUnique.mockResolvedValue({
      gdprConsent: false,
      dataProcessingConsent: {},
      email: 'a@b.c',
    });
    const ok = await service.canSendMarketing('u1', 'IN_APP');
    expect(ok).toBe(true);
  });

  it('canSendMarketing rejects when gdpr false', async () => {
    prisma.user.findUnique.mockResolvedValue({
      gdprConsent: false,
      dataProcessingConsent: { marketing: true },
      email: 'a@b.c',
    });
    const ok = await service.canSendMarketing('u1', 'EMAIL');
    expect(ok).toBe(false);
  });

  it('canSendMarketing rejects email opt-out', async () => {
    prisma.loyaltyMembership.findUnique.mockResolvedValue({ optInEmail: false });
    const ok = await service.canSendMarketing('u1', 'EMAIL');
    expect(ok).toBe(false);
  });
});
