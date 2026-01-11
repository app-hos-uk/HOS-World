import { Module, forwardRef } from '@nestjs/common';
import { CourierService } from './courier.service';
import { CourierController } from './courier.controller';
import { DatabaseModule } from '../../database/database.module';
import { RoyalMailProvider } from './providers/royal-mail.provider';
import { FedExProvider } from './providers/fedex.provider';
import { DHLProvider } from './providers/dhl.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [CourierController],
  providers: [
    CourierService,
    RoyalMailProvider,
    FedExProvider,
    DHLProvider,
  ],
  exports: [CourierService],
})
export class CourierModule {
  constructor(
    private courierService: CourierService,
    private royalMail: RoyalMailProvider,
    private fedex: FedExProvider,
    private dhl: DHLProvider,
  ) {
    // Register providers on module init
    setTimeout(() => {
      this.courierService.registerProvider('royal-mail', this.royalMail);
      this.courierService.registerProvider('fedex', this.fedex);
      this.courierService.registerProvider('dhl', this.dhl);
    }, 0);
  }
}
