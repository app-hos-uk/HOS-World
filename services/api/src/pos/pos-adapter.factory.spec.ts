import { BadRequestException } from '@nestjs/common';
import { POSAdapterFactory } from './pos-adapter.factory';

describe('POSAdapterFactory', () => {
  const encryption = {
    decryptJson: jest.fn().mockReturnValue({
      domainPrefix: 'demo',
      accessToken: 'tok',
    }),
  };
  const platformRegion = {
    getCurrency: jest.fn().mockResolvedValue('USD'),
  };

  it('creates lightspeed adapter', () => {
    const factory = new POSAdapterFactory(encryption as any, platformRegion as any);
    const enc = 'encrypted-blob';
    const a = factory.create('lightspeed', enc);
    expect(a.providerName).toBe('lightspeed');
    expect(encryption.decryptJson).toHaveBeenCalledWith(enc);
  });

  it('throws on unknown provider', () => {
    const factory = new POSAdapterFactory(encryption as any, platformRegion as any);
    expect(() => factory.create('unknown', 'x')).toThrow(BadRequestException);
  });
});
