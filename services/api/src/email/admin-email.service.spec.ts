import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminEmailService } from './admin-email.service';
import { PrismaService } from '../database/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { QueueService, JobType } from '../queue/queue.service';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { TemplatesService } from '../templates/templates.service';

describe('AdminEmailService', () => {
  let service: AdminEmailService;

  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    adminEmailCampaign: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    emailTemplate: {
      upsert: jest.fn(),
    },
    messageLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const messaging = {
    canSendMarketing: jest.fn(),
    send: jest.fn(),
  };

  const queue = {
    addJob: jest.fn(),
  };

  const flags = {
    isEnabled: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string, def?: unknown) => {
      if (key === 'ADMIN_EMAIL_RECIPIENT_CAP') return 2000;
      return def;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    flags.isEnabled.mockReturnValue(true);
    service = new AdminEmailService(
      prisma as unknown as PrismaService,
      messaging as unknown as MessagingService,
      queue as unknown as QueueService,
      flags as unknown as FeatureFlagsService,
      config as unknown as ConfigService,
      { render: jest.fn() } as unknown as TemplatesService,
    );
  });

  const activeUser = (overrides: Record<string, unknown> = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'a@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'CUSTOMER',
    ...overrides,
  });

  describe('sendCampaign', () => {
    it('dry-run does not call messaging.send or queue.addJob', async () => {
      prisma.user.findMany.mockResolvedValue([
        activeUser(),
        activeUser({
          id: '22222222-2222-4222-8222-222222222222',
          email: 'b@example.com',
        }),
      ]);
      messaging.canSendMarketing.mockImplementation(async (userId: string) =>
        userId.startsWith('1111'),
      );

      const result = await service.sendCampaign(
        {
          audienceType: 'INDIVIDUAL',
          userIds: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
          ],
          subject: 'Hello {{firstName}}',
          bodyHtml: '<p>Hi {{firstName}}</p>',
          // dryRun omitted → dry run
        },
        'admin-1',
      );

      expect(result).toMatchObject({
        dryRun: true,
        targeted: 2,
        wouldSend: 1,
        skippedConsent: 1,
        skippedNoEmail: 0,
      });
      expect(messaging.send).not.toHaveBeenCalled();
      expect(queue.addJob).not.toHaveBeenCalled();
      expect(prisma.adminEmailCampaign.create).not.toHaveBeenCalled();
    });

    it('live send creates campaign, upserts snapshot template, and queues the job', async () => {
      const userId = '11111111-1111-4111-8111-111111111111';
      prisma.user.findMany.mockResolvedValue([activeUser({ id: userId })]);
      prisma.adminEmailCampaign.create.mockResolvedValue({
        id: 'campaign-1',
        subject: 'Hello',
        bodyHtml: '<p>Hi</p>',
      });
      prisma.adminEmailCampaign.update.mockResolvedValue({});
      prisma.emailTemplate.upsert.mockResolvedValue({});
      queue.addJob.mockResolvedValue('job-1');

      const result = await service.sendCampaign(
        {
          audienceType: 'INDIVIDUAL',
          userIds: [userId],
          subject: 'Hello {{firstName}}',
          bodyHtml: '<p>Hi {{firstName}}</p>',
          templateSlug: 'loyalty_announcement',
          dryRun: false,
        },
        'admin-1',
      );

      expect(result).toEqual({
        dryRun: false,
        campaignId: 'campaign-1',
        jobId: 'job-1',
        targeted: 1,
      });

      expect(prisma.adminEmailCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject: 'Hello {{firstName}}',
            bodyHtml: '<p>Hi {{firstName}}</p>',
            templateSlug: 'loyalty_announcement',
            audienceType: 'INDIVIDUAL',
            recipientCount: 1,
            status: 'QUEUED',
            sentBy: 'admin-1',
          }),
        }),
      );

      expect(prisma.emailTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'admin_campaign_campaign-1' },
          create: expect.objectContaining({
            slug: 'admin_campaign_campaign-1',
            description: 'Admin campaign snapshot',
            variables: expect.arrayContaining(['firstName']),
          }),
        }),
      );

      expect(prisma.adminEmailCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'campaign-1' },
          data: expect.objectContaining({
            audienceQuery: expect.objectContaining({
              snapshotSlug: 'admin_campaign_campaign-1',
            }),
          }),
        }),
      );

      expect(queue.addJob).toHaveBeenCalledWith(JobType.ADMIN_EMAIL_CAMPAIGN, {
        campaignId: 'campaign-1',
      });
      expect(messaging.send).not.toHaveBeenCalled();
    });

    it('throws when audience exceeds cap', async () => {
      const manyIds = Array.from({ length: 3 }, (_, i) =>
        `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`,
      );
      // Cap overridden via config mock — rebuild service with cap 2
      config.get.mockImplementation((key: string, def?: unknown) => {
        if (key === 'ADMIN_EMAIL_RECIPIENT_CAP') return 2;
        return def;
      });
      service = new AdminEmailService(
        prisma as unknown as PrismaService,
        messaging as unknown as MessagingService,
        queue as unknown as QueueService,
        flags as unknown as FeatureFlagsService,
        config as unknown as ConfigService,
      );

      prisma.user.findMany.mockResolvedValue(
        manyIds.map((id, i) =>
          activeUser({ id, email: `u${i}@example.com` }),
        ),
      );

      await expect(
        service.sendCampaign(
          {
            audienceType: 'INDIVIDUAL',
            userIds: manyIds,
            subject: 'Hi',
            bodyHtml: '<p>Hi</p>',
            dryRun: false,
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queue.addJob).not.toHaveBeenCalled();
      expect(prisma.adminEmailCampaign.create).not.toHaveBeenCalled();
    });

    it('throws when feature flag is disabled', async () => {
      flags.isEnabled.mockImplementation(
        (flag: FeatureFlag) => flag !== FeatureFlag.ADMIN_EMAIL_COMPOSE,
      );

      await expect(
        service.sendCampaign(
          {
            audienceType: 'ALL',
            subject: 'Hi',
            bodyHtml: '<p>Hi</p>',
            dryRun: false,
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
