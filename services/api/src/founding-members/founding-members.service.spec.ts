import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoundingMembersService } from './founding-members.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('FoundingMembersService import deduplication', () => {
  let service: FoundingMembersService;
  let prisma: {
    foundingMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let notifications: {
    sendFoundingMemberConfirmation: jest.Mock;
    sendFoundingMemberAccountInvitation: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      foundingMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    notifications = {
      sendFoundingMemberConfirmation: jest.fn().mockResolvedValue(false),
      sendFoundingMemberAccountInvitation: jest.fn().mockResolvedValue(undefined),
    };

    service = new FoundingMembersService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      { get: jest.fn((key: string) => (key === 'FRONTEND_URL' ? 'http://localhost:3000' : undefined)) } as unknown as ConfigService,
    );
  });

  describe('previewImport', () => {
    it('flags founding-member duplicates, existing users, and in-file duplicates', async () => {
      prisma.foundingMember.findMany.mockResolvedValue([{ email: 'fm@example.com' }]);
      prisma.user.findMany.mockResolvedValue([{ email: 'user@example.com' }]);

      const preview = await service.previewImport([
        { email: 'new@example.com', firstName: 'New' },
        { email: 'fm@example.com', firstName: 'ExistingFM' },
        { email: 'user@example.com', firstName: 'ExistingUser' },
        { email: 'dup@example.com', firstName: 'DupA' },
        { email: 'dup@example.com', firstName: 'DupB' },
        { email: 'bad', firstName: 'Bad' },
      ]);

      expect(preview.ready).toBe(1);
      expect(preview.duplicate).toBe(1);
      expect(preview.existingUser).toBe(1);
      expect(preview.duplicateInFile).toBe(2);
      expect(preview.invalid).toBe(1);

      const byEmail = Object.fromEntries(preview.rows.map((r) => [r.email, r.status]));
      expect(byEmail['new@example.com']).toBe('ready');
      expect(byEmail['fm@example.com']).toBe('duplicate');
      expect(byEmail['user@example.com']).toBe('existing_user');
      expect(byEmail['dup@example.com']).toBe('duplicate_in_file');
      expect(byEmail['bad']).toBe('invalid');
    });
  });

  describe('bulkImport', () => {
    it('skips existing founding members and platform users when skipDuplicates is true', async () => {
      prisma.foundingMember.findMany.mockResolvedValue([{ email: 'fm@example.com' }]);
      prisma.user.findMany.mockResolvedValue([{ email: 'user@example.com' }]);
      prisma.foundingMember.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.foundingMember.create.mockImplementation(async ({ data }: any) => ({
        ...data,
        id: 'new-id',
        metadata: null,
      }));

      const result = await service.bulkImport(
        [
          { email: 'new@example.com', firstName: 'New' },
          { email: 'fm@example.com', firstName: 'FM' },
          { email: 'user@example.com', firstName: 'User' },
          { email: 'dup@example.com', firstName: 'A' },
          { email: 'dup@example.com', firstName: 'B' },
        ],
        { skipDuplicates: true },
      );

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.createdEmails).toEqual(['new@example.com']);
      expect(prisma.foundingMember.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('adminCreate', () => {
    it('rejects emails that already belong to a platform user', async () => {
      prisma.foundingMember.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

      await expect(
        service.adminCreate({
          email: 'user@example.com',
          firstName: 'Existing',
          fandoms: [],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('sendConfirmationToAll', () => {
    it('excludes deactivated at query time and counts skipped reasons separately', async () => {
      prisma.foundingMember.count.mockResolvedValueOnce(2); // deactivated
      prisma.foundingMember.findMany.mockResolvedValue([
        {
          id: 'a1',
          email: 'new@example.com',
          firstName: 'New',
          metadata: null,
          status: 'REGISTERED',
        },
        {
          id: 'a2',
          email: 'sent@example.com',
          firstName: 'Sent',
          metadata: { confirmationEmailSentAt: '2026-01-01T00:00:00.000Z' },
          status: 'REGISTERED',
        },
      ]);
      notifications.sendFoundingMemberConfirmation.mockResolvedValue(true);
      prisma.foundingMember.update.mockResolvedValue({});

      const result = await service.sendConfirmationToAll({ onlyUnsent: true });

      expect(prisma.foundingMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { not: 'DEACTIVATED' } },
        }),
      );
      expect(result.skippedDeactivated).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.sent).toBe(1);
      expect(notifications.sendFoundingMemberConfirmation).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendAccountInvitations', () => {
    it('counts deactivated selected members in skippedDeactivated', async () => {
      prisma.foundingMember.count
        .mockResolvedValueOnce(1) // deactivated among selected
        .mockResolvedValueOnce(0); // already invited
      prisma.foundingMember.findMany.mockResolvedValue([
        {
          id: 'active-1',
          email: 'active@example.com',
          firstName: 'Active',
          metadata: null,
          status: 'REGISTERED',
        },
      ]);
      prisma.foundingMember.update.mockResolvedValue({});

      const result = await service.sendAccountInvitations({
        onlyUnsent: true,
        memberIds: ['active-1', 'deactivated-1'],
      });

      expect(prisma.foundingMember.count).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'DEACTIVATED',
            id: { in: ['active-1', 'deactivated-1'] },
          }),
        }),
      );
      expect(result.skippedDeactivated).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.sent).toBe(1);
    });
  });
});
