import { BadRequestException } from '@nestjs/common';
import { AccountingAdminController } from './accounting-admin.controller';

/**
 * The daily-journal backfill lets an operator pick a period, so the date is
 * validated before it reaches the journal builder — a malformed or future date
 * would otherwise post journals for the wrong period.
 */
describe('AccountingAdminController — daily journal backfill', () => {
  let accounting: any;
  let dailyJournals: any;
  let controller: AccountingAdminController;

  beforeEach(() => {
    accounting = { assertEnabled: jest.fn() };
    dailyJournals = {
      defaultPeriodDate: jest.fn().mockReturnValue('2026-08-05'),
      enqueueForPeriod: jest.fn().mockImplementation((periodDate?: string) =>
        Promise.resolve({
          periodDate: periodDate ?? '2026-08-05',
          enqueued: ['ONLINE_SALES'],
          skipped: [],
        }),
      ),
    };

    controller = new AccountingAdminController(
      accounting,
      {} as any,
      {} as any,
      {} as any,
      dailyJournals,
    );
  });

  it('defaults to the prior UTC day when no date is given', async () => {
    const res = await controller.runDailyJournals({});

    expect(dailyJournals.enqueueForPeriod).toHaveBeenCalledWith(undefined);
    expect(res.message).toContain('2026-08-05');
  });

  it('passes a valid period through', async () => {
    const res = await controller.runDailyJournals({ periodDate: '2026-07-01' });

    expect(dailyJournals.enqueueForPeriod).toHaveBeenCalledWith('2026-07-01');
    expect((res.data as any).periodDate).toBe('2026-07-01');
  });

  it('rejects a malformed date', async () => {
    await expect(controller.runDailyJournals({ periodDate: '01-07-2026' })).rejects.toThrow(
      BadRequestException,
    );
    expect(dailyJournals.enqueueForPeriod).not.toHaveBeenCalled();
  });

  it('rejects an impossible calendar date', async () => {
    await expect(controller.runDailyJournals({ periodDate: '2026-13-45' })).rejects.toThrow(
      BadRequestException,
    );
    expect(dailyJournals.enqueueForPeriod).not.toHaveBeenCalled();
  });

  it('rejects an overflow date that would roll into the next month', async () => {
    await expect(controller.runDailyJournals({ periodDate: '2026-02-30' })).rejects.toThrow(
      BadRequestException,
    );
    expect(dailyJournals.enqueueForPeriod).not.toHaveBeenCalled();
  });

  it('rejects a period after the last complete UTC day', async () => {
    await expect(controller.runDailyJournals({ periodDate: '2026-08-06' })).rejects.toThrow(
      BadRequestException,
    );
    expect(dailyJournals.enqueueForPeriod).not.toHaveBeenCalled();
  });

  it('refuses to run while accounting is disabled', async () => {
    accounting.assertEnabled.mockImplementation(() => {
      throw new BadRequestException('Accounting disabled');
    });

    await expect(controller.runDailyJournals({ periodDate: '2026-07-01' })).rejects.toThrow(
      BadRequestException,
    );
    expect(dailyJournals.enqueueForPeriod).not.toHaveBeenCalled();
  });
});
