import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { StripeProvider } from './providers/stripe.provider';
import { KlarnaProvider } from './providers/klarna.provider';

@Injectable()
export class PaymentProviderService {
  private readonly logger = new Logger(PaymentProviderService.name);
  private providers: Map<string, PaymentProvider> = new Map();

  constructor(
    private stripeProvider: StripeProvider,
    private klarnaProvider: KlarnaProvider,
  ) {
    // Register available providers
    if (this.stripeProvider.isAvailable()) {
      this.providers.set('stripe', this.stripeProvider);
      this.logger.log('Stripe provider registered');
    }

    if (this.klarnaProvider.isAvailable()) {
      this.providers.set('klarna', this.klarnaProvider);
      this.logger.log('Klarna provider registered');
    }

    this.logger.log(`Registered ${this.providers.size} payment provider(s)`);
  }

  /**
   * Get a payment provider by name
   */
  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new BadRequestException(
        `Payment provider '${name}' is not available. Available providers: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }
    return provider;
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(name: string): boolean {
    return this.providers.has(name.toLowerCase());
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
