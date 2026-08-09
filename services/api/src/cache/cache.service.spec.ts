import { CacheService } from './cache.service';

describe('CacheService.set', () => {
  let cacheManager: { set: jest.Mock; get: jest.Mock; del: jest.Mock; reset: jest.Mock };
  let service: CacheService;

  beforeEach(() => {
    cacheManager = { set: jest.fn(), get: jest.fn(), del: jest.fn(), reset: jest.fn() };
    service = new CacheService(cacheManager as any);
  });

  it('stores an ordinary value', async () => {
    await service.set('taxzone:GB', { id: 'zone-1' }, 300);

    expect(cacheManager.set).toHaveBeenCalledWith('taxzone:GB', { id: 'zone-1' }, 300);
  });

  // cache-manager throws "not a cacheable value" on null, which turned a location with no
  // matching tax zone into a 500 during checkout.
  it.each([null, undefined])('skips %p instead of letting the store throw', async (value) => {
    await expect(service.set('taxzone:XX', value)).resolves.toBeUndefined();

    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('still caches falsy values that are genuinely cacheable', async () => {
    await service.set('count:0', 0);
    await service.set('flag:off', false);
    await service.set('name:empty', '');

    expect(cacheManager.set).toHaveBeenCalledTimes(3);
  });
});
