import { CACHE_NONE_SENTINEL, CacheService } from './cache.service';

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

  it('stores a sentinel for null so "no tax zone" is a cacheable result', async () => {
    await service.set('taxzone:XX', null, 300);

    expect(cacheManager.set).toHaveBeenCalledWith('taxzone:XX', CACHE_NONE_SENTINEL, 300);
  });

  it('skips undefined instead of letting the store throw', async () => {
    await expect(service.set('taxzone:XX', undefined)).resolves.toBeUndefined();

    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('still caches falsy values that are genuinely cacheable', async () => {
    await service.set('count:0', 0);
    await service.set('flag:off', false);
    await service.set('name:empty', '');

    expect(cacheManager.set).toHaveBeenCalledTimes(3);
  });

  it('get() unwraps the none sentinel to null and treats a store miss as undefined', async () => {
    cacheManager.get.mockResolvedValueOnce(CACHE_NONE_SENTINEL);
    await expect(service.get('taxzone:XX')).resolves.toBeNull();

    cacheManager.get.mockResolvedValueOnce(undefined);
    await expect(service.get('taxzone:YY')).resolves.toBeUndefined();

    cacheManager.get.mockResolvedValueOnce({ id: 'zone-1' });
    await expect(service.get('taxzone:GB')).resolves.toEqual({ id: 'zone-1' });
  });
});
