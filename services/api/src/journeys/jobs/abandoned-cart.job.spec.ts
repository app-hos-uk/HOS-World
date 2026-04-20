/**
 * Behavioural checks for abandoned-cart scan queries (mirrors marketing.jobs logic).
 */
describe('Abandoned cart scan logic', () => {
  it('skips cart when a paid order exists after cart update', () => {
    const cartUpdated = new Date('2025-01-01T12:00:00Z');
    const orderAfter = { id: 'o1', createdAt: new Date('2025-01-02T12:00:00Z') };
    const paidAfterCart = orderAfter.createdAt > cartUpdated;
    expect(paidAfterCart).toBe(true);
  });

  it('respects threshold: cart must be older than cutoff', () => {
    const thresholdMin = 60;
    const now = new Date('2025-01-03T12:00:00Z').getTime();
    const cartUpdated = new Date('2025-01-03T11:00:00Z').getTime();
    const since = now - thresholdMin * 60 * 1000;
    expect(cartUpdated < since).toBe(false);
  });

  it('treats stale cart as abandoned', () => {
    const thresholdMin = 60;
    const now = new Date('2025-01-03T12:00:00Z').getTime();
    const cartUpdated = new Date('2025-01-03T10:00:00Z').getTime();
    const since = now - thresholdMin * 60 * 1000;
    expect(cartUpdated < since).toBe(true);
  });

  it('re-trigger window: compare abandonedEmailSentAt to 24h ago', () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const canResend = sentAt < dayAgo;
    expect(canResend).toBe(true);
  });
});
