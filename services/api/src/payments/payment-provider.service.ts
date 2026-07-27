import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { StripeProvider } from './providers/stripe.provider';

@Injectable()
export class PaymentProviderService implements OnModuleInit {
  private readonly logger = new Logger(PaymentProviderService.name);
  private providers: Map<string, PaymentProvider> = new Map();

  constructor(private stripeProvider: StripeProvider) {}

  async onModuleInit() {
    await this.ensureStripeRegistered();
    this.logger.log(`${this.providers.size} payment provider(s) available`);
  }

  /**
   * Ensure Stripe is initialized from integrations/env and registered.
   * Safe to call repeatedly (e.g. from /payments/providers after a cold start miss).
   */
  async ensureStripeRegistered(): Promise<void> {
    if (!this.stripeProvider.isAvailable()) {
      try {
        await this.stripeProvider.initFromIntegrations();
      } catch (err: any) {
        this.logger.warn(`Stripe initFromIntegrations failed: ${err?.message || err}`);
      }
    }

    // Brief poll in case another init is still in flight
    for (let i = 0; i < 10 && !this.stripeProvider.isAvailable(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (this.stripeProvider.isAvailable()) {
      if (!this.providers.has('stripe')) {
        this.providers.set('stripe', this.stripeProvider);
        this.logger.log('Stripe provider registered');
      }
    } else if (this.providers.has('stripe')) {
      this.providers.delete('stripe');
      this.logger.warn('Stripe provider removed — client no longer available');
    }
  }

  /**
   * Lazy check: if a provider was not available at startup but became available later
   * (e.g. integration activated at runtime), this re-checks before failing.
   */
  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (provider) return provider;

    // Lazy registration for stripe (may have initialized after startup)
    if (name.toLowerCase() === 'stripe' && this.stripeProvider.isAvailable()) {
      this.providers.set('stripe', this.stripeProvider);
      this.logger.log('Stripe provider lazy-registered');
      return this.stripeProvider;
    }

    throw new BadRequestException(
      `Payment provider '${name}' is not available. Available providers: ${Array.from(this.providers.keys()).join(', ') || 'none'}`,
    );
  }

  /**
   * Get all available providers (sync snapshot). Prefer ensureAvailableProviders() for HTTP.
   */
  getAvailableProviders(): string[] {
    if (!this.providers.has('stripe') && this.stripeProvider.isAvailable()) {
      this.providers.set('stripe', this.stripeProvider);
    }
    return Array.from(this.providers.keys());
  }

  /**
   * Actively (re)initialize Stripe if needed, then return the provider list.
   */
  async ensureAvailableProviders(): Promise<string[]> {
    if (!this.stripeProvider.isAvailable() || !this.providers.has('stripe')) {
      await this.ensureStripeRegistered();
    }
    return this.getAvailableProviders();
  }

  /**
   * Check if a provider is available (includes lazy registration for stripe)
   */
  isProviderAvailable(name: string): boolean {
    if (this.providers.has(name.toLowerCase())) return true;
    if (name.toLowerCase() === 'stripe' && this.stripeProvider.isAvailable()) {
      this.providers.set('stripe', this.stripeProvider);
      return true;
    }
    return false;
  }

  /**
   * Register a custom payment provider
   */
  registerProvider(provider: PaymentProvider): void {
    if (provider.isAvailable()) {
      this.providers.set(provider.name.toLowerCase(), provider);
      this.logger.log(`Custom payment provider '${provider.name}' registered`);
    } else {
      this.logger.warn(
        `Payment provider '${provider.name}' is not available and will not be registered`,
      );
    }
  }
}
