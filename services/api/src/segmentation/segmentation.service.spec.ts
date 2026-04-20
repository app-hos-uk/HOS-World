import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SegmentationService } from './segmentation.service';
import { PrismaService } from '../database/prisma.service';

describe('SegmentationService', () => {
  let service: SegmentationService;
  let prisma: any;

  const sampleRules = {
    operator: 'AND',
    rules: [{ dimension: 'tier.level', operator: 'gte', value: 1 }],
  };

  beforeEach(async () => {
    prisma = {
      audienceSegment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 's1', ...data })),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 's1', ...data })),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      segmentMembership: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u1', _count: { eventAttendances: 0, quizAttempts: 0 } }]),
        count: jest.fn().mockResolvedValue(1),
      },
      loyaltyMembership: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SegmentationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, def?: number) => def ?? (k === 'SEGMENT_EVAL_BATCH_SIZE' ? 500 : 10)),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SegmentationService);
  });

  it('validateRules accepts valid rules', () => {
    service.validateRules(sampleRules as any);
  });

  it('validateRules throws on unknown dimension', () => {
    expect(() =>
      service.validateRules({
        operator: 'AND',
        rules: [{ dimension: 'bad.one', operator: 'eq', value: 1 } as any],
      }),
    ).toThrow(BadRequestException);
  });

  it('create generates slug and evaluates', async () => {
    prisma.user.findMany.mockResolvedValueOnce([]);
    const s = await service.create(
      { name: 'Test seg', rules: sampleRules as any } as any,
      'admin1',
    );
    expect(s.slug).toMatch(/^test-seg/);
    expect(prisma.audienceSegment.create).toHaveBeenCalled();
  });

  it('archive clears memberships', async () => {
    prisma.audienceSegment.findUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    await service.archive('s1');
    expect(prisma.segmentMembership.deleteMany).toHaveBeenCalledWith({ where: { segmentId: 's1' } });
  });

  it('delete only when archived', async () => {
    prisma.audienceSegment.findUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    await expect(service.delete('s1')).rejects.toThrow(BadRequestException);
    prisma.audienceSegment.findUnique.mockResolvedValue({ id: 's1', status: 'ARCHIVED' });
    await service.delete('s1');
    expect(prisma.audienceSegment.delete).toHaveBeenCalled();
  });

  it('findById throws when missing', async () => {
    prisma.audienceSegment.findUnique.mockResolvedValue(null);
    await expect(service.findById('x')).rejects.toThrow(NotFoundException);
  });

  it('evaluateSegment diffs memberships', async () => {
    prisma.audienceSegment.findUnique.mockResolvedValue({
      id: 's1',
      status: 'ACTIVE',
      type: 'DYNAMIC',
      rules: sampleRules,
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', _count: { eventAttendances: 0, quizAttempts: 0 } }]);
    prisma.segmentMembership.findMany.mockResolvedValue([{ userId: 'u2' }]);
    const r = await service.evaluateSegment('s1');
    expect(r.added).toBeGreaterThanOrEqual(0);
    expect(r.removed).toBeGreaterThanOrEqual(0);
    expect(prisma.segmentMembership.createMany).toHaveBeenCalled();
  });

  it('previewSegment returns shape', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'u1', _count: { eventAttendances: 0, quizAttempts: 0 } }])
      .mockResolvedValueOnce([
        {
          id: 'u1',
          email: 'a@b.c',
          firstName: 'A',
          country: 'GB',
          _count: { eventAttendances: 0, quizAttempts: 0 },
          loyaltyMembership: { tier: { name: 'T' } },
        },
      ]);
    prisma.user.count.mockResolvedValue(1);
    const p = await service.previewSegment(sampleRules as any);
    expect(p.count).toBe(1);
    expect(p.sampleUsers.length).toBeGreaterThan(0);
  });

  it('touchActivity updates membership', async () => {
    await service.touchActivity('u1');
    expect(prisma.loyaltyMembership.updateMany).toHaveBeenCalled();
  });

  it('getUserSegments maps segments', async () => {
    prisma.segmentMembership.findMany.mockResolvedValue([
      { segment: { id: 's1', name: 'S' } },
    ]);
    const rows = await service.getUserSegments('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('S');
  });
});
