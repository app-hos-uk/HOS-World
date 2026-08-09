import { BadRequestException } from '@nestjs/common';
import { PaymentProviderService } from './payment-provider.service';
import { StripeProvider } from './providers/stripe.provider';
import { PaymentProvider } from './interfaces/payment-provider.interface';

describe('PaymentProviderService', () => {
  let service: PaymentProviderService;
  let stripeProvider: jest.Mocked<
    Pick<StripeProvider, 'isAvailable' | 'ensureReady' | 'clearClient'>
  >;

  const mockStripeProvider = (
    overrides: Partial<Record<keyof PaymentProvider, unknown>> = {},
  ): PaymentProvider =>
    ({
      name: 'stripe',
      isAvailable: () => true,
      createPaymentIntent: jest.fn(),
      confirmPayment: jest.fn(),
      refundPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      validateWebhook: jest.fn(),
      processWebhook: jest.fn(),
      ...overrides,
    }) as PaymentProvider;

  beforeEach(() => {
    stripeProvider = {
      isAvailable: jest.fn().mockReturnValue(false),
      ensureReady: jest.fn().mockResolvedValue(undefined),
      clearClient: jest.fn(),
    };
    service = new PaymentProviderService(stripeProvider as unknown as StripeProvider);
  });

  describe('getProvider', () => {
    it('returns registered provider by name', () => {
      const provider = mockStripeProvider();
      service.registerProvider(provider);

      expect(service.getProvider('stripe')).toBe(provider);
    });

    it('lazy-registers stripe when client becomes available', () => {
      stripeProvider.isAvailable.mockReturnValue(true);

      const provider = service.getProvider('stripe');

      expect(provider).toBe(stripeProvider);
    });

    it('throws when provider is unavailable', () => {
      expect(() => service.getProvider('paypal')).toThrow(BadRequestException);
    });
  });

  describe('registerProvider / unregisterStripe', () => {
    it('registers available custom providers', () => {
      const custom = mockStripeProvider({ name: 'custom' });

      service.registerProvider(custom);

      expect(service.getAvailableProviders()).toContain('custom');
    });

    it('unregisters stripe and clears client', () => {
      stripeProvider.isAvailable.mockReturnValue(true);
      service.registerProvider(mockStripeProvider());

      service.unregisterStripe();
      stripeProvider.isAvailable.mockReturnValue(false);

      expect(stripeProvider.clearClient).toHaveBeenCalledWith({ disableEnvFallback: true });
      expect(service.isProviderAvailable('stripe')).toBe(false);
    });
  });

  describe('ensureStripeRegistered', () => {
    it('registers stripe after ensureReady succeeds', async () => {
      stripeProvider.isAvailable.mockReturnValueOnce(false).mockReturnValue(true);

      await service.ensureStripeRegistered();

      expect(stripeProvider.ensureReady).toHaveBeenCalled();
      expect(service.isProviderAvailable('stripe')).toBe(true);
    });

    it('force reload passes option to stripe provider', async () => {
      stripeProvider.isAvailable.mockReturnValue(true);

      await service.ensureStripeRegistered({ forceReload: true });

      expect(stripeProvider.ensureReady).toHaveBeenCalledWith({
        forceReload: true,
        allowEnvFallback: true,
      });
    });
  });

  describe('ensureAvailableProviders', () => {
    it('returns list of available provider names', async () => {
      stripeProvider.isAvailable.mockReturnValue(true);

      const providers = await service.ensureAvailableProviders();

      expect(providers).toContain('stripe');
    });
  });
});
