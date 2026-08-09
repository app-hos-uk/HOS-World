import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CalculateShippingRateDto } from './calculate-shipping-rate.dto';
import { GetShippingOptionsDto } from './get-shipping-options.dto';

// Mirrors the global pipe configured in main.ts, so these assertions describe what the running
// API does rather than what the DTO would do under different settings.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const run = (metatype: any, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype, data: '' });

describe('shipping quote request validation', () => {
  describe('POST /shipping/calculate', () => {
    it('rejects an empty body rather than reaching the handler', async () => {
      await expect(run(CalculateShippingRateDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing destination, which is what produced the 500', async () => {
      await expect(
        run(CalculateShippingRateDto, { cartValue: 10, weight: 2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a complete quote request', async () => {
      const result = await run(CalculateShippingRateDto, {
        cartValue: 49.99,
        weight: 1.5,
        destination: { country: 'GB', state: 'London', city: 'London', postalCode: 'EC1A 1BB' },
      });

      expect(result).toMatchObject({ cartValue: 49.99, weight: 1.5 });
      expect(result.destination.country).toBe('GB');
    });

    it('accepts a destination carrying only the required country', async () => {
      await expect(
        run(CalculateShippingRateDto, { cartValue: 10, weight: 1, destination: { country: 'US' } }),
      ).resolves.toBeDefined();
    });
  });

  describe('POST /shipping/options', () => {
    it('rejects an empty body rather than iterating undefined cartItems', async () => {
      await expect(run(GetShippingOptionsDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects cartItems that is not an array', async () => {
      await expect(
        run(GetShippingOptionsDto, {
          cartItems: 'nope',
          cartValue: 10,
          destination: { country: 'GB' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // The storefront sends price on every line and never sends weight. If this ever fails,
    // checkout breaks in production, because forbidNonWhitelisted rejects unknown properties.
    it('accepts the payload the storefront actually sends', async () => {
      const result = await run(GetShippingOptionsDto, {
        cartItems: [
          { productId: 'p-1', quantity: 2, price: 19.99 },
          { productId: 'p-2', quantity: 1, price: 5 },
        ],
        cartValue: 44.98,
        destination: { country: 'GB', state: null, city: 'London', postalCode: 'EC1A 1BB' },
      });

      expect(result.cartItems).toHaveLength(2);
      expect(result.cartItems[0].price).toBe(19.99);
    });

    it('still accepts weight for callers that provide it', async () => {
      const result = await run(GetShippingOptionsDto, {
        cartItems: [{ productId: 'p-1', quantity: 1, weight: 2.5 }],
        cartValue: 10,
        destination: { country: 'GB' },
      });

      expect(result.cartItems[0].weight).toBe(2.5);
    });

    it('rejects an unknown property so typos surface as 400 rather than being ignored', async () => {
      await expect(
        run(GetShippingOptionsDto, {
          cartItems: [],
          cartValue: 10,
          destination: { country: 'GB' },
          destinaton: { country: 'GB' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
