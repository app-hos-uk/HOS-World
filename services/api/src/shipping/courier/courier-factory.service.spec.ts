import { BadGatewayException } from '@nestjs/common';
import { CourierFactoryService } from './courier-factory.service';
import { ShippoProvider } from './providers/shippo.provider';
import type { RateRequest } from './interfaces/courier-provider.interface';

const shippoRow = {
  provider: 'shippo',
  credentials: 'enc',
  isTestMode: true,
  isActive: true,
  priority: 1,
};

const rateRequest: RateRequest = {
  from: {
    name: 'Warehouse',
    street1: '1 Main',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
  },
  to: {
    name: 'Customer',
    street1: '2 Oak',
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90001',
    country: 'US',
  },
  packages: [{ length: 10, width: 10, height: 10, weight: 0.5 }],
};

function createService(decryptJson: jest.Mock, findMany?: jest.Mock) {
  const prisma = {
    integrationConfig: {
      findMany: findMany ?? jest.fn().mockResolvedValue([shippoRow]),
    },
  };
  const encryption = { decryptJson };
  return new CourierFactoryService(prisma as any, encryption as any);
}

describe('CourierFactoryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the previous provider map when every configured provider fails to load', async () => {
    const decryptJson = jest
      .fn()
      .mockReturnValueOnce({ apiToken: 'shippo_test_ok' })
      .mockImplementation(() => {
        throw new Error('bad key');
      });
    const service = createService(decryptJson);

    await service.loadProviders();
    expect(service.getAvailableProviderNames()).toEqual(['shippo']);

    await service.loadProviders();
    expect(service.getAvailableProviderNames()).toEqual(['shippo']);
  });

  it('swaps to an empty map when the database returns no integrations', async () => {
    const decryptJson = jest.fn().mockReturnValue({ apiToken: 'shippo_test_ok' });
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([shippoRow])
      .mockResolvedValueOnce([]);
    const service = createService(decryptJson, findMany);

    await service.loadProviders();
    expect(service.getAvailableProviderNames()).toEqual(['shippo']);

    await service.loadProviders();
    expect(service.getAvailableProviderNames()).toEqual([]);
  });

  it('skips a carrier quote for a short window after a transient failure', async () => {
    const decryptJson = jest.fn().mockReturnValue({ apiToken: 'shippo_test_ok' });
    const service = createService(decryptJson);
    await service.loadProviders();

    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const getRates = jest
      .spyOn(ShippoProvider.prototype, 'getRates')
      .mockRejectedValueOnce(new Error('Request timed out after 15000ms'))
      .mockResolvedValue([]);

    await expect(service.getRates('shippo', rateRequest)).rejects.toBeInstanceOf(BadGatewayException);
    await expect(service.getRates('shippo', rateRequest)).rejects.toThrow(/carrier recently failed/);
    expect(getRates).toHaveBeenCalledTimes(1);

    now += 15_001;
    await expect(service.getRates('shippo', rateRequest)).resolves.toEqual([]);
    expect(getRates).toHaveBeenCalledTimes(2);
  });

  it('does not open the quote circuit for address/config errors', async () => {
    const decryptJson = jest.fn().mockReturnValue({ apiToken: 'shippo_test_ok' });
    const service = createService(decryptJson);
    await service.loadProviders();

    const getRates = jest
      .spyOn(ShippoProvider.prototype, 'getRates')
      .mockRejectedValue(new Error('destination address rejected'));

    await expect(service.getRates('shippo', rateRequest)).rejects.toBeInstanceOf(Error);
    await expect(service.getRates('shippo', rateRequest)).rejects.toBeInstanceOf(Error);
    expect(getRates).toHaveBeenCalledTimes(2);
  });
});
