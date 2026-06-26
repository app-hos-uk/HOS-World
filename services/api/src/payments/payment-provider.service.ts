import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { StripeProvider } from './providers/stripe.provider';

@Injectable()
export class PaymentProviderService implements OnModuleInit {
  private readonly logger = new Logger(PaymentProviderService.name);
  private providers: Map<string, PaymentProvider> = new Map();

  constructor(
    private stripeProvider: StripeProvider,
  ) {
    if (this.stripeProvider.isAvailable()) {
      this.providers.set('stripe', this.stripeProvider);
      this.logger.log('Stripe provider registered (from env)');
    }
  }

  async onModuleInit() {
    // StripeProvider.onModuleInit fires initFromIntegrations (async). Poll briefly for it.
    for (let i = 0; i < 10; i++) {
      if (this.stripeProvider.isAvailable()) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!this.providers.has('stripe') && this.stripeProvider.isAvailable()) {
      this.providers.set('stripe', this.stripeProvider);
      this.logger.log('Stripe provider registered (from admin integrations)');
    }
    this.logger.log(`${this.providers.size} payment provider(s) available`);
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
   * Get all available providers
   */
  getAvailableProviders(): string[] {
    // Include stripe if it became available after startup
    if (!this.providers.has('stripe') && this.stripeProvider.isAvailable()) {
      this.providers.set('stripe', this.stripeProvider);
    }
    return Array.from(this.providers.keys());
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
