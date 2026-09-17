import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyMemberEmailService } from './loyalty-member-email.service';
import { PrismaService } from '../../database/prisma.service';
import { MessagingService } from '../../messaging/messaging.service';
import { TemplatesService } from '../../templates/templates.service';

describe('LoyaltyMemberEmailService', () => {
  let service: LoyaltyMemberEmailService;

  const prisma = {
    loyaltyMembership: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const messaging = {
    canSendMarketing: jest.fn(),
    send: jest.fn(),
  };

  const templates = {
    getTemplate: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string, def?: unknown) => {
      if (key === 'LOYALTY_MEMBER_EMAIL_CAP') return 2000;
      if (key === 'LOYALTY_LOGIN_URL') return 'https://join.houseofspells.com';
      return def;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoyaltyMemberEmailService(
      prisma as unknown as PrismaService,
      messaging as unknown as MessagingService,
      templates as unknown as TemplatesService,
      config as unknown as ConfigService,
    );
    templates.getTemplate.mockResolvedValue({ slug: 'loyalty_announcement', channel: 'EMAIL' });
  });

  describe('resolveRecipients', () => {
    it('resolves members by user id', async () => {
      prisma.loyaltyMembership.findMany.mockResolvedValue([
        {
          userId: 'u1',
          cardNumber: 'HOS-001',
          currentBalance: 500,
          user: { email: 'a@example.com', firstName: 'Ada' },
          tier: { name: 'Spellcaster' },
        },
      ]);

      const recipients = await service.resolveRecipients({
        templateSlug: 'loyalty_announcement',
        memberIds: ['u1'],
      });

      expect(recipients).toHaveLength(1);
      expect(recipients[0]).toMatchObject({
        userId: 'u1',
        email: 'a@example.com',
        pointsBalance: 500,
        tierName: 'Spellcaster',
      });
    });

    it('requires memberIds or sendToAll', async () => {
      await expect(
        service.resolveRecipients({ templateSlug: 'loyalty_announcement' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects sendToAll when count exceeds cap', async () => {
      prisma.loyaltyMembership.count.mockResolvedValue(2500);

      await expect(
        service.resolveRecipients({
          templateSlug: 'loyalty_announcement',
          sendToAll: true,
        }),
      ).rejects.toThrow(/maximum is 2000/);
    });

    it('applies onlyUnverified filter for sendToAll', async () => {
      prisma.loyaltyMembership.count.mockResolvedValue(1);
      prisma.loyaltyMembership.findMany.mockResolvedValue([]);

      await service.resolveRecipients({
        templateSlug: 'loyalty_verify_reminder',
        sendToAll: true,
        onlyUnverified: true,
        search: 'test@example.com',
      });

      expect(prisma.loyaltyMembership.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    user: expect.objectContaining({
                      email: { contains: 'test@example.com', mode: 'insensitive' },
                    }),
                  }),
                ]),
              }),
              { user: { emailVerified: false } },
            ]),
          }),
        }),
      );
    });
  });

  describe('sendMemberEmails', () => {
    it('counts skipped consent on dry run', async () => {
      prisma.loyaltyMembership.findMany.mockResolvedValue([
        {
          userId: 'u1',
          cardNumber: null,
          currentBalance: 100,
          user: { email: 'ok@example.com', firstName: 'Ok' },
          tier: { name: 'Spellcaster' },
        },
        {
          userId: 'u2',
          cardNumber: null,
          currentBalance: 50,
          user: { email: 'no@example.com', firstName: 'No' },
          tier: { name: 'Spellcaster' },
        },
      ]);
      messaging.canSendMarketing.mockImplementation(async (userId: string) => userId === 'u1');

      const result = await service.sendMemberEmails({
        templateSlug: 'loyalty_announcement',
        memberIds: ['u1', 'u2'],
        dryRun: true,
      });

      expect(result).toEqual({
        targeted: 2,
        sent: 1,
        failed: 0,
        skippedConsent: 1,
        errors: [],
      });
      expect(messaging.send).not.toHaveBeenCalled();
    });

    it('counts sent, failed, and skipped consent on live send', async () => {
      prisma.loyaltyMembership.findMany.mockResolvedValue([
        {
          userId: 'u1',
          cardNumber: 'HOS-1',
          currentBalance: 100,
          user: { email: 'sent@example.com', firstName: 'Sent' },
          tier: { name: 'Spellcaster' },
        },
        {
          userId: 'u2',
          cardNumber: 'HOS-2',
          currentBalance: 50,
          user: { email: 'skip@example.com', firstName: 'Skip' },
          tier: { name: 'Spellcaster' },
        },
        {
          userId: 'u3',
          cardNumber: 'HOS-3',
          currentBalance: 25,
          user: { email: 'fail@example.com', firstName: 'Fail' },
          tier: { name: 'Spellcaster' },
        },
      ]);
      messaging.send.mockImplementation(async ({ userId }: { userId: string }) => {
        if (userId === 'u1') return { success: true };
        if (userId === 'u2') return { success: false, error: 'SKIPPED_CONSENT' };
        return { success: false, error: 'SMTP down' };
      });

      const result = await service.sendMemberEmails({
        templateSlug: 'loyalty_announcement',
        memberIds: ['u1', 'u2', 'u3'],
      });

      expect(result.targeted).toBe(3);
      expect(result.sent).toBe(1);
      expect(result.skippedConsent).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('fail@example.com');
    });
  });
});
