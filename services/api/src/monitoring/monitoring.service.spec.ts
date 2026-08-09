import { MonitoringService } from './monitoring.service';

describe('MonitoringService error accounting', () => {
  const build = () => new MonitoringService({ get: () => undefined } as any);

  it('counts a failed request once, not once per reporting path', () => {
    const service = build();

    // What the interceptor does for a 5xx: record the request, then report the exception.
    service.trackRequest(12, false);
    service.captureException(new Error('kaboom'));

    const { requests } = service.getMetrics();
    expect(requests.total).toBe(1);
    expect(requests.errors).toBe(1);
    expect(requests.errorRate).toBe(100);
  });

  it('keeps the error rate at zero when only client errors occur', () => {
    const service = build();

    service.trackRequest(5, true);
    service.trackRequest(5, true);

    const { requests } = service.getMetrics();
    expect(requests.total).toBe(2);
    expect(requests.errors).toBe(0);
    expect(requests.errorRate).toBe(0);
  });

  it('never reports an error rate above 100%', () => {
    const service = build();

    for (let i = 0; i < 3; i++) {
      service.trackRequest(1, false);
      service.captureException(new Error('kaboom'));
    }

    expect(service.getMetrics().requests.errorRate).toBeLessThanOrEqual(100);
  });
});
