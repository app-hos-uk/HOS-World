import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

describe('EventsController', () => {
  const mockEvents = {
    findUpcoming: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getMyRsvps: jest.fn().mockResolvedValue([]),
    getMyAttendances: jest.fn().mockResolvedValue([]),
    rsvp: jest.fn().mockResolvedValue({ id: 'r1' }),
    cancelRsvp: jest.fn().mockResolvedValue(undefined),
    checkIn: jest.fn().mockResolvedValue({ id: 'a1' }),
    getDetailForUser: jest.fn().mockResolvedValue({ slug: 'x' }),
  };

  const mockJwt = { verify: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function setup() {
    const mod = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: mockEvents },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    return mod.get(EventsController);
  }

  it('list passes optional userId when JWT valid', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'u1' });
    const ctrl = await setup();
    const req = { headers: { authorization: 'Bearer tok' } };
    await ctrl.list(req as any, undefined, undefined, undefined, 1, 20);
    expect(mockEvents.findUpcoming).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', page: 1, limit: 20 }),
    );
  });

  it('list omits userId when no bearer', async () => {
    const ctrl = await setup();
    await ctrl.list({ headers: {} } as any);
    expect(mockEvents.findUpcoming).toHaveBeenCalledWith(
      expect.objectContaining({ userId: undefined }),
    );
  });

  it('myRsvps uses auth user', async () => {
    const ctrl = await setup();
    const r = await ctrl.myRsvps({ user: { id: 'u1' } } as any);
    expect(r.data).toEqual([]);
    expect(mockEvents.getMyRsvps).toHaveBeenCalledWith('u1');
  });

  it('rsvp forwards id and body', async () => {
    const ctrl = await setup();
    await ctrl.rsvp({ user: { id: 'u1' } } as any, 'e1', { guestCount: 1 });
    expect(mockEvents.rsvp).toHaveBeenCalledWith('e1', 'u1', { guestCount: 1 });
  });

  it('cancelRsvp calls service', async () => {
    const ctrl = await setup();
    await ctrl.cancelRsvp({ user: { id: 'u1' } } as any, 'e1');
    expect(mockEvents.cancelRsvp).toHaveBeenCalledWith('e1', 'u1');
  });

  it('checkIn forwards', async () => {
    const ctrl = await setup();
    await ctrl.checkIn({ user: { id: 'u1' } } as any, 'e1', { ticketCode: 'X' });
    expect(mockEvents.checkIn).toHaveBeenCalledWith('e1', 'u1', { ticketCode: 'X' });
  });

  it('detail passes slug and optional user', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'u2' });
    const ctrl = await setup();
    await ctrl.detail({ headers: { authorization: 'Bearer t' } } as any, 'my-slug');
    expect(mockEvents.getDetailForUser).toHaveBeenCalledWith('my-slug', 'u2');
  });
});
