import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CourierService } from './courier.service';
import { CourierController } from './courier.controller';
import { CourierFactoryService } from './courier-factory.service';
import { DatabaseModule } from '../../database/database.module';
import { RoyalMailLegacyProvider } from './providers/legacy/royal-mail-legacy.provider';
import { FedExLegacyProvider } from './providers/legacy/fedex-legacy.provider';
import { DHLLegacyProvider } from './providers/legacy/dhl-legacy.provider';

/**
 * CourierModule - Shipping carrier integration
 * 
 * Two approaches are available:
 * 1. Legacy: CourierService with manually registered providers (backward compatible)
 *    - Uses RoyalMailLegacyProvider, FedExLegacyProvider, DHLLegacyProvider
 *    - Providers use simulated rates and labels for basic functionality
 * 2. New: CourierFactoryService which loads providers from IntegrationConfig database
 *    - Uses RoyalMailProvider, FedExProvider, DHLProvider with real API integration
 *    - Credentials stored encrypted in database
 * 
 * For new code, use CourierFactoryService which supports dynamic credential management.
 */
@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [CourierController],
  providers: [
    CourierService,
    CourierFactoryService,
    RoyalMailLegacyProvider,
    FedExLegacyProvider,
    DHLLegacyProvider,
  ],
  exports: [CourierService, CourierFactoryService],
})
export class CourierModule implements OnModuleInit {
  constructor(
    private courierService: CourierService,
    private royalMail: RoyalMailLegacyProvider,
    private fedex: FedExLegacyProvider,
    private dhl: DHLLegacyProvider,
  ) {}

  /**
   * Register legacy providers synchronously during module initialization.
   * This lifecycle hook runs after all modules are initialized but before
   * the application starts accepting requests, ensuring providers are
   * available when CourierService methods are called.
   */
  onModuleInit() {
    this.courierService.registerProvider('royal-mail', this.royalMail);
    this.courierService.registerProvider('fedex', this.fedex);
    this.courierService.registerProvider('dhl', this.dhl);
  }
}
