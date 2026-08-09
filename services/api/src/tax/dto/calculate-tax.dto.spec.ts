import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CalculateTaxDto } from './calculate-tax.dto';

// Mirrors the global pipe configured in main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const run = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: CalculateTaxDto, data: '' });

describe('POST /tax/calculate validation', () => {
  it('rejects an empty body rather than reaching the handler', async () => {
    await expect(run({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing location, which is what produced the 500', async () => {
    await expect(run({ amount: 10, taxClassId: 'tc-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a negative amount', async () => {
    await expect(
      run({ amount: -1, taxClassId: 'tc-1', location: { country: 'GB' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts the payload the checkout page sends', async () => {
    const result = await run({
      amount: 39.98,
      taxClassId: 'tax-class-1',
      location: { country: 'GB', state: null, city: 'London', postalCode: 'EC1A 1BB' },
    });

    expect(result.amount).toBe(39.98);
    expect(result.location.country).toBe('GB');
  });
});
