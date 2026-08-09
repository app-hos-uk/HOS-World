import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { MonitoringInterceptor } from './monitoring.interceptor';

describe('MonitoringInterceptor error classification', () => {
  let monitoring: {
    trackRequest: jest.Mock;
    captureException: jest.Mock;
  };
  let metrics: { incrementCounter: jest.Mock; recordHistogram: jest.Mock };
  let logger: {
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    setCorrelationId: jest.Mock;
  };
  let interceptor: MonitoringInterceptor;

  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        url: '/api/thing',
        route: { path: '/thing' },
        headers: {},
      }),
    }),
  } as unknown as ExecutionContext;

  const runWith = async (error: unknown) => {
    const next: CallHandler = { handle: () => throwError(() => error) };
    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toBe(error);
  };

  beforeEach(() => {
    monitoring = { trackRequest: jest.fn(), captureException: jest.fn() };
    metrics = { incrementCounter: jest.fn(), recordHistogram: jest.fn() };
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setCorrelationId: jest.fn(),
    };
    interceptor = new MonitoringInterceptor(monitoring as any, metrics as any, logger as any);
  });

  describe('server errors', () => {
    it.each([
      ['a plain Error', new Error('kaboom')],
      ['a 500 HttpException', new InternalServerErrorException('kaboom')],
      ['a 503 HttpException', new ServiceUnavailableException('down')],
    ])('reports %s to Sentry and counts it against the error rate', async (_label, error) => {
      await runWith(error);

      expect(monitoring.captureException).toHaveBeenCalledTimes(1);
      expect(monitoring.trackRequest).toHaveBeenCalledWith(expect.any(Number), false);
      expect(metrics.incrementCounter).toHaveBeenCalledWith('http_errors_total');
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('client errors', () => {
    it.each([
      ['400', new BadRequestException('q query parameter is required')],
      ['401', new UnauthorizedException()],
      ['403', new ForbiddenException()],
      ['404', new NotFoundException()],
    ])('does not report a %s to Sentry or the error rate', async (_label, error) => {
      await runWith(error);

      expect(monitoring.captureException).not.toHaveBeenCalled();
      expect(monitoring.trackRequest).toHaveBeenCalledWith(expect.any(Number), true);
      expect(metrics.incrementCounter).toHaveBeenCalledWith('http_client_errors_total');
      expect(metrics.incrementCounter).not.toHaveBeenCalledWith('http_errors_total');
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs a malformed request at warn so it stays visible', async () => {
      await runWith(new BadRequestException('q query parameter is required'));

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('400: q query parameter is required'),
        'MonitoringInterceptor',
      );
    });

    it.each([
      ['401', new UnauthorizedException()],
      ['403', new ForbiddenException()],
      ['404', new NotFoundException()],
    ])('keeps routine %s traffic at debug', async (_label, error) => {
      await runWith(error);

      expect(logger.debug).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  it('still records successful requests', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(interceptor.intercept(context, next));

    expect(monitoring.trackRequest).toHaveBeenCalledWith(expect.any(Number), true);
    expect(metrics.recordHistogram).toHaveBeenCalledWith(
      'http_request_duration_seconds',
      expect.any(Number),
    );
    expect(monitoring.captureException).not.toHaveBeenCalled();
  });
});
