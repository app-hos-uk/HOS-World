import { JourneyService } from './journey.service';

describe('JourneyService', () => {
  let service: JourneyService;
  let prisma: any;
  let messaging: { send: jest.Mock };

  const journeyRow = (steps: unknown[]) => ({
    id: 'j1',
    slug: 'test',
    triggerEvent: 'TEST',
    steps,
    isActive: true,
  });

  beforeEach(() => {
    messaging = { send: jest.fn().mockResolvedValue({ success: true }) };
    prisma = {
      segmentMembership: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sm1' }),
      },
      marketingJourney: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      journeyEnrollment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      messageLog: { count: jest.fn().mockResolvedValue(0) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          firstName: 'A',
          loyaltyMembership: { tier: { name: 'T' }, purchaseCount: 0, currentBalance: 10 },
        }),
      },
    };
    service = new JourneyService(prisma, messaging as any);
  });

  it('enrollUser creates enrollment when none exists', async () => {
    prisma.marketingJourney.findUnique.mockResolvedValue(journeyRow([{ stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 't' }]));
    prisma.journeyEnrollment.findUnique.mockResolvedValue(null);
    prisma.journeyEnrollment.create.mockResolvedValue({ id: 'e1' });
    const r = await service.enrollUser('test', 'u1', {});
    expect(r).toEqual({ id: 'e1' });
    expect(prisma.journeyEnrollment.create).toHaveBeenCalled();
  });

  it('enrollUser skips duplicate ACTIVE', async () => {
    prisma.marketingJourney.findUnique.mockResolvedValue(journeyRow([]));
    prisma.journeyEnrollment.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    const r = await service.enrollUser('test', 'u1');
    expect(r).toBeNull();
  });

  it('cancelEnrollment updates status', async () => {
    prisma.journeyEnrollment.update.mockResolvedValue({});
    await service.cancelEnrollment('e1');
    expect(prisma.journeyEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });

  it('matchesTriggerConditions returns true when no conditions', async () => {
    const j = journeyRow([]);
    const ok = await service.matchesTriggerConditions(j as any, 'u1');
    expect(ok).toBe(true);
  });

  it('matchesTriggerConditions requires segment membership when segmentId set', async () => {
    const j = { ...journeyRow([]), segmentId: 'seg1' };
    prisma.segmentMembership.findUnique.mockResolvedValueOnce(null);
    const ok = await service.matchesTriggerConditions(j as any, 'u1');
    expect(ok).toBe(false);
    prisma.segmentMembership.findUnique.mockResolvedValueOnce({ id: 'x' });
    const ok2 = await service.matchesTriggerConditions(j as any, 'u1');
    expect(ok2).toBe(true);
  });

  it('getJourneyStats aggregates', async () => {
    prisma.journeyEnrollment.count = jest
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    prisma.messageLog.count = jest.fn().mockResolvedValue(5);
    const s = await service.getJourneyStats('jid');
    expect(s).toEqual({ active: 1, completed: 2, cancelled: 0, messages: 5 });
  });

  it('processDueEnrollments calls processStep', async () => {
    prisma.journeyEnrollment.findMany.mockResolvedValue([{ id: 'e1' }]);
    const spy = jest.spyOn(service, 'processStep').mockResolvedValue();
    await service.processDueEnrollments(10);
    expect(spy).toHaveBeenCalledWith('e1');
    spy.mockRestore();
  });

  describe('processStep', () => {
    const makeEnrollment = (step: number, journey: any, meta?: Record<string, unknown>) => ({
      id: 'e1',
      userId: 'u1',
      journeyId: 'j1',
      currentStep: step,
      status: 'ACTIVE',
      metadata: meta || {},
      journey,
    });

    it('SEND step sends message and advances', async () => {
      const journey = journeyRow([
        { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 'tpl-welcome' },
      ]);
      const enrollment = makeEnrollment(0, journey);
      prisma.journeyEnrollment.findUnique.mockResolvedValueOnce(enrollment);
      prisma.journeyEnrollment.findUnique.mockResolvedValueOnce({ ...enrollment, currentStep: 1, status: 'ACTIVE' });
      prisma.journeyEnrollment.update.mockResolvedValue({});

      await service.processStep('e1');

      expect(messaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          channel: 'EMAIL',
          templateSlug: 'tpl-welcome',
        }),
      );
      expect(prisma.journeyEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentStep: 1 }) }),
      );
    });

    it('SEND step without templateSlug marks enrollment as FAILED', async () => {
      const journey = journeyRow([{ stepIndex: 0, type: 'SEND', channel: 'EMAIL' }]);
      const enrollment = makeEnrollment(0, journey);
      prisma.journeyEnrollment.findUnique.mockResolvedValue(enrollment);
      prisma.journeyEnrollment.update.mockResolvedValue({});

      await service.processStep('e1');

      expect(messaging.send).not.toHaveBeenCalled();
      expect(prisma.journeyEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('WAIT step with zero delay advances immediately', async () => {
      const journey = journeyRow([
        { stepIndex: 0, type: 'WAIT', delayMinutes: 0 },
        { stepIndex: 1, type: 'SEND', channel: 'EMAIL', templateSlug: 't' },
      ]);
      const enrollment = makeEnrollment(0, journey);
      const afterWait = makeEnrollment(1, journey);
      prisma.journeyEnrollment.findUnique
        .mockResolvedValueOnce(enrollment)
        .mockResolvedValueOnce(afterWait)
        .mockResolvedValueOnce({ ...afterWait, currentStep: 2, status: 'ACTIVE' });
      prisma.journeyEnrollment.update.mockResolvedValue({});

      await service.processStep('e1');

      const updateCalls = prisma.journeyEnrollment.update.mock.calls;
      const firstUpdate = updateCalls[0][0].data;
      expect(firstUpdate.currentStep).toBe(1);
    });

    it('WAIT step with positive delay schedules and pauses', async () => {
      const journey = journeyRow([
        { stepIndex: 0, type: 'WAIT', delayMinutes: 60 },
      ]);
      const enrollment = makeEnrollment(0, journey);
      prisma.journeyEnrollment.findUnique.mockResolvedValue(enrollment);
      prisma.journeyEnrollment.update.mockResolvedValue({});

      await service.processStep('e1');

      const updateCall = prisma.journeyEnrollment.update.mock.calls[0][0].data;
      expect(updateCall.metadata).toEqual(
        expect.objectContaining({ waitScheduledForStep: 0 }),
      );
      expect(updateCall.nextStepAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('CONDITION true-branch continues to next step', async () => {
      const journey = journeyRow([
        {
          stepIndex: 0,
          type: 'CONDITION',
          condition: { field: 'user.loyaltyMembership.purchaseCount', operator: 'gt', value: -1 },
          skipToStep: 3,
        },
        { stepIndex: 1, type: 'SEND', channel: 'EMAIL', templateSlug: 't' },
      ]);
      const enrollment = makeEnrollment(0, journey);
      const afterCond = makeEnrollment(1, journey);
      prisma.journeyEnrollment.findUnique
        .mockResolvedValueOnce(enrollment)
        .mockResolvedValueOnce(afterCond)
        .mockResolvedValueOnce({ ...afterCond, currentStep: 2, status: 'ACTIVE' });
      prisma.journeyEnrollment.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        firstName: 'A',
        loyaltyMembership: { tier: { name: 'T' }, purchaseCount: 5, currentBalance: 10 },
      });

      await service.processStep('e1');

      const firstAdvance = prisma.journeyEnrollment.update.mock.calls[0][0].data;
      expect(firstAdvance.currentStep).toBe(1);
    });

    it('CONDITION false-branch skips to skipToStep', async () => {
      const journey = journeyRow([
        {
          stepIndex: 0,
          type: 'CONDITION',
          condition: { field: 'user.loyaltyMembership.purchaseCount', operator: 'gt', value: 9999 },
          skipToStep: 3,
        },
        { stepIndex: 1, type: 'SEND', channel: 'EMAIL', templateSlug: 't' },
        { stepIndex: 2, type: 'SEND', channel: 'EMAIL', templateSlug: 't2' },
      ]);
      const enrollment = makeEnrollment(0, journey);
      prisma.journeyEnrollment.findUnique
        .mockResolvedValueOnce(enrollment)
        .mockResolvedValueOnce({ ...enrollment, currentStep: 3, status: 'ACTIVE' });
      prisma.journeyEnrollment.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        firstName: 'A',
        loyaltyMembership: { tier: { name: 'T' }, purchaseCount: 0, currentBalance: 10 },
      });

      await service.processStep('e1');

      const firstAdvance = prisma.journeyEnrollment.update.mock.calls[0][0].data;
      expect(firstAdvance.currentStep).toBe(3);
    });

    it('unknown step type advances past the step', async () => {
      const journey = journeyRow([
        { stepIndex: 0, type: 'UNKNOWN_TYPE' },
        { stepIndex: 1, type: 'SEND', channel: 'EMAIL', templateSlug: 't' },
      ]);
      const enrollment = makeEnrollment(0, journey);
      const afterSkip = makeEnrollment(1, journey);
      prisma.journeyEnrollment.findUnique
        .mockResolvedValueOnce(enrollment)
        .mockResolvedValueOnce(afterSkip)
        .mockResolvedValueOnce({ ...afterSkip, currentStep: 2, status: 'ACTIVE' });
      prisma.journeyEnrollment.update.mockResolvedValue({});

      await service.processStep('e1');

      const firstAdvance = prisma.journeyEnrollment.update.mock.calls[0][0].data;
      expect(firstAdvance.currentStep).toBe(1);
    });

    it('completes enrollment when past all steps', async () => {
      const journey = journeyRow([
        { stepIndex: 0, type: 'SEND', channel: 'EMAIL', templateSlug: 't' },
      ]);
      const enrollment = makeEnrollment(1, journey);
      prisma.journeyEnrollment.findUnique.mockResolvedValue(enrollment);
      prisma.journeyEnrollment.update.mockResolvedValue({});

      await service.processStep('e1');

      expect(prisma.journeyEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });
});
