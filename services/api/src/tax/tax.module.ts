import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import { TaxFactoryService } from './tax-factory.service';
import { DatabaseModule } from '../database/database.module';

/**
 * TaxModule - Tax calculation and compliance
 * 
 * Two approaches are available:
 * 1. TaxService - Uses manually configured tax zones and rates from database
 * 2. TaxFactoryService - Uses external providers (Avalara, TaxJar) loaded from IntegrationConfig
 * 
 * The TaxFactoryService will fall back to TaxService if no external provider is configured.
 * Provider instances (AvalaraProvider, TaxJarProvider) are created dynamically by TaxFactoryService
 * with credentials loaded from the encrypted IntegrationConfig table.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [TaxController],
  providers: [
    TaxService,
    TaxFactoryService,
  ],
  exports: [TaxService, TaxFactoryService],
})
export class TaxModule {}
