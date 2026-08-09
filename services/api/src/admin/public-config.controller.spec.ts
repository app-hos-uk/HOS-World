import { PublicConfigController } from './public-config.controller';

describe('PublicConfigController getRegion', () => {
  it('returns the public region shape and does not leak taxOrigin', async () => {
    const platformRegion = {
      getRegion: jest.fn().mockResolvedValue({
        currency: 'USD',
        country: 'US',
        locale: 'en-US',
        timezone: 'America/New_York',
        taxOrigin: {
          street: '1564 Broadway',
          city: 'New York',
          state: 'NY',
          postalCode: '10036',
          country: 'US',
        },
      }),
    };

    const controller = new PublicConfigController(
      {} as any,
      { isEnabled: jest.fn() } as any,
      { isEnabled: jest.fn() } as any,
      platformRegion as any,
    );

    const result = await controller.getRegion();

    expect(result).toEqual({
      currency: 'USD',
      country: 'US',
      locale: 'en-US',
      timezone: 'America/New_York',
    });
    expect(result).not.toHaveProperty('taxOrigin');
    expect(JSON.stringify(result)).not.toContain('1564 Broadway');
    expect(JSON.stringify(result)).not.toContain('taxOrigin');
  });
});
