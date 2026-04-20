import { MarketingEventBus } from './marketing-event.bus';

describe('MarketingEventBus', () => {
  it('emit iterates journeys and enrolls', async () => {
    const prisma = {
      marketingJourney: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'j1', slug: 'a', triggerEvent: 'E', triggerConditions: null },
        ]),
      },
    };
    const journeyService = {
      matchesTriggerConditions: jest.fn().mockResolvedValue(true),
      enrollUser: jest.fn().mockResolvedValue({ id: 'e1' }),
    };
    const bus = new MarketingEventBus(prisma as any, journeyService as any);
    await bus.emit('E', 'u1', { x: 1 });
    expect(journeyService.enrollUser).toHaveBeenCalledWith('a', 'u1', { x: 1 });
  });

  it('emit skips when conditions fail', async () => {
    const prisma = {
      marketingJourney: {
        findMany: jest.fn().mockResolvedValue([{ id: 'j1', slug: 'a', triggerEvent: 'E' }]),
      },
    };
    const journeyService = {
      matchesTriggerConditions: jest.fn().mockResolvedValue(false),
      enrollUser: jest.fn(),
    };
    const bus = new MarketingEventBus(prisma as any, journeyService as any);
    await bus.emit('E', 'u1');
    expect(journeyService.enrollUser).not.toHaveBeenCalled();
  });

  it('emit swallows journey errors', async () => {
    const prisma = {
      marketingJourney: {
        findMany: jest.fn().mockResolvedValue([{ id: 'j1', slug: 'a', triggerEvent: 'E' }]),
      },
    };
    const journeyService = {
      matchesTriggerConditions: jest.fn().mockResolvedValue(true),
      enrollUser: jest.fn().mockRejectedValue(new Error('fail')),
    };
    const bus = new MarketingEventBus(prisma as any, journeyService as any);
    await expect(bus.emit('E', 'u1')).resolves.toBeUndefined();
  });

  it('emit handles empty journey list', async () => {
    const prisma = { marketingJourney: { findMany: jest.fn().mockResolvedValue([]) } };
    const journeyService = { matchesTriggerConditions: jest.fn(), enrollUser: jest.fn() };
    const bus = new MarketingEventBus(prisma as any, journeyService as any);
    await bus.emit('E', 'u1');
    expect(journeyService.enrollUser).not.toHaveBeenCalled();
  });
});
