import { Test } from '@nestjs/testing';
import { SegmentationAdminController } from './segmentation-admin.controller';
import { SegmentationService } from './segmentation.service';
import { MessagingService } from '../messaging/messaging.service';
import { QueueService } from '../queue/queue.service';
import { ConfigService } from '@nestjs/config';

describe('SegmentationAdminController', () => {
  let controller: SegmentationAdminController;
  const segmentation = {
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findTemplates: jest.fn().mockResolvedValue([]),
    dimensionsCatalog: jest.fn().mockReturnValue([]),
    create: jest.fn().mockResolvedValue({ id: 's1' }),
    findById: jest.fn().mockResolvedValue({ id: 's1', members: 0 }),
    update: jest.fn().mockResolvedValue({ id: 's1' }),
    archive: jest.fn().mockResolvedValue({ id: 's1' }),
    delete: jest.fn().mockResolvedValue(undefined),
    evaluateSegment: jest.fn().mockResolvedValue({ added: 0, removed: 0, total: 0 }),
    previewSegment: jest.fn().mockResolvedValue({ count: 0, sampleUsers: [] }),
    getSegmentMembers: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getSegmentUserIds: jest.fn().mockResolvedValue(['u1']),
  };
  const messaging = { sendMultiChannel: jest.fn().mockResolvedValue([{ success: true }]) };
  const queue = { addJob: jest.fn().mockResolvedValue('job1') };
  const config = { get: jest.fn((_, def: number) => def) };

  beforeEach(async () => {
    const m = await Test.createTestingModule({
      controllers: [SegmentationAdminController],
      providers: [
        { provide: SegmentationService, useValue: segmentation },
        { provide: MessagingService, useValue: messaging },
        { provide: QueueService, useValue: queue },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    controller = m.get(SegmentationAdminController);
    jest.clearAllMocks();
  });

  it('list', async () => {
    const r = await controller.list();
    expect(segmentation.findAll).toHaveBeenCalled();
    expect(r.data).toBeDefined();
  });

  it('create', async () => {
    await controller.create({ name: 'N', rules: { operator: 'AND', rules: [] } } as any, {
      user: { id: 'a1' },
    });
    expect(segmentation.create).toHaveBeenCalled();
  });

  it('refresh enqueues all', async () => {
    await controller.refreshAll();
    expect(queue.addJob).toHaveBeenCalled();
  });

  it('preview', async () => {
    await controller.preview({ rules: { operator: 'AND', rules: [] } } as any);
    expect(segmentation.previewSegment).toHaveBeenCalled();
  });

  it('broadcast', async () => {
    const r = await controller.broadcast('s1', {
      channels: ['EMAIL'],
      templateSlug: 't1',
    });
    expect(segmentation.getSegmentUserIds).toHaveBeenCalledWith('s1');
    expect(messaging.sendMultiChannel).toHaveBeenCalled();
    expect(r.data).toMatchObject({ targeted: 1 });
  });
});
