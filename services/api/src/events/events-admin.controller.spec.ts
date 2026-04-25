import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventsAdminController } from './events-admin.controller';
import { EventsService } from './events.service';

describe('EventsAdminController', () => {
  const mockEvents = {
    adminList: jest.fn().mockImplementation(async (f: { page?: number; limit?: number }) => ({
      items: [],
      total: 0,
      page: f.page ?? 1,
      limit: f.limit ?? 20,
    })),
    create: jest.fn().mockResolvedValue({ id: 'e-new' }),
    getRsvpsForAdmin: jest.fn().mockResolvedValue([]),
    getAttendees: jest.fn().mockResolvedValue([]),
    getEventStats: jest.fn().mockResolvedValue({ attended: 0 }),
    publish: jest.fn().mockResolvedValue({}),
    cancel: jest.fn().mockResolvedValue({}),
    complete: jest.fn().mockResolvedValue({}),
    checkInByTicket: jest.fn().mockResolvedValue({}),
    checkIn: jest.fn().mockResolvedValue({}),
    inviteToEvent: jest.fn().mockResolvedValue({ invited: 1 }),
    findById: jest.fn().mockResolvedValue({ id: 'e1' }),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => jest.clearAllMocks());

  async function ctrl() {
    const mod = await Test.createTestingModule({
      controllers: [EventsAdminController],
      providers: [{ provide: EventsService, useValue: mockEvents }],
    }).compile();
    return mod.get(EventsAdminController);
  }

  it('list returns paginated wrapper', async () => {
    const c = await ctrl();
    const r = await c.list('PUBLISHED', 's1', 2, 10);
    expect(r.data).toEqual(expect.objectContaining({ page: 2, limit: 10 }));
    expect(mockEvents.adminList).toHaveBeenCalledWith({
      status: 'PUBLISHED',
      storeId: 's1',
      page: 2,
      limit: 10,
    });
  });

  it('create passes creator id', async () => {
    const c = await ctrl();
    await c.create({ user: { id: 'admin-1' } } as any, { title: 'T' } as any);
    expect(mockEvents.create).toHaveBeenCalledWith({ title: 'T' }, 'admin-1');
  });

  it('checkIn uses ticket path', async () => {
    const c = await ctrl();
    await c.checkIn({ user: { id: 'staff' } } as any, 'e1', { ticketCode: 'ABCD' });
    expect(mockEvents.checkInByTicket).toHaveBeenCalledWith('e1', 'ABCD', 'staff');
  });

  it('checkIn uses userId path', async () => {
    const c = await ctrl();
    await c.checkIn({ user: { id: 'staff' } } as any, 'e1', { userId: 'u9' });
    expect(mockEvents.checkIn).toHaveBeenCalledWith('e1', 'u9', { method: 'MANUAL' }, 'staff');
  });

  it('checkIn rejects without identifiers', async () => {
    const c = await ctrl();
    await expect(c.checkIn({ user: { id: 'staff' } } as any, 'e1', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('get bundles event and stats', async () => {
    const c = await ctrl();
    const r = await c.get('e1');
    expect(mockEvents.findById).toHaveBeenCalledWith('e1');
    expect(mockEvents.getEventStats).toHaveBeenCalledWith('e1');
    expect(r.data).toEqual({ event: { id: 'e1' }, stats: { attended: 0 } });
  });

  it('cancel passes reason', async () => {
    const c = await ctrl();
    await c.cancel('e1', { reason: 'weather' });
    expect(mockEvents.cancel).toHaveBeenCalledWith('e1', 'weather');
  });

  it('invite delegates', async () => {
    const c = await ctrl();
    await c.invite('e1', { limit: 10, minTierLevel: 1 } as any);
    expect(mockEvents.inviteToEvent).toHaveBeenCalledWith('e1', { limit: 10, minTierLevel: 1 });
  });

  it('remove calls service', async () => {
    const c = await ctrl();
    await c.remove('e1');
    expect(mockEvents.remove).toHaveBeenCalledWith('e1');
  });
});
