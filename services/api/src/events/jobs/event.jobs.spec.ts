import { ConfigService } from '@nestjs/config';
import { EventJobsService } from './event.jobs';
import { JobType } from '../../queue/queue.service';
import { EventsService } from '../events.service';

describe('EventJobsService', () => {
  it('registers processors and schedules repeatables', async () => {
    const registerProcessor = jest.fn();
    const addRepeatable = jest.fn().mockResolvedValue(undefined);
    const queue = { registerProcessor, addRepeatable };
    const config = {
      get: jest.fn((key: string, def: string) => {
        if (key === 'EVENT_REMINDER_CRON') return '0 9 * * *';
        if (key === 'EVENT_RECONCILE_CRON') return '0 1 * * *';
        return def;
      }),
    };
    const events = {
      sendRemindersWindow: jest.fn().mockResolvedValue(undefined),
      reconcileEndedEvents: jest.fn().mockResolvedValue(undefined),
    };

    const svc = new EventJobsService(queue as any, config as unknown as ConfigService, events as any);
    await svc.onModuleInit();

    expect(registerProcessor).toHaveBeenCalledWith(JobType.EVENT_REMINDER, expect.any(Function));
    expect(registerProcessor).toHaveBeenCalledWith(
      JobType.EVENT_ATTENDANCE_RECONCILE,
      expect.any(Function),
    );

    const reminderFn = registerProcessor.mock.calls.find((c) => c[0] === JobType.EVENT_REMINDER)?.[1];
    await reminderFn({} as any);
    expect(events.sendRemindersWindow).toHaveBeenCalled();

    const reconFn = registerProcessor.mock.calls.find(
      (c) => c[0] === JobType.EVENT_ATTENDANCE_RECONCILE,
    )?.[1];
    await reconFn({} as any);
    expect(events.reconcileEndedEvents).toHaveBeenCalled();

    expect(addRepeatable).toHaveBeenCalledWith(JobType.EVENT_REMINDER, {}, '0 9 * * *');
    expect(addRepeatable).toHaveBeenCalledWith(JobType.EVENT_ATTENDANCE_RECONCILE, {}, '0 1 * * *');
  });
});
