import { Module, forwardRef } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsBulkService } from './products-bulk.service';
import { ProductsCacheHook } from './products-cache.hook';
import { ProductViewSchedulerService } from './product-view-scheduler.service';
import { VolumePricingService } from './volume-pricing.service';
import { VolumePricingController } from './volume-pricing.controller';
import { BundleController } from './bundle.controller';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => CacheModule), DatabaseModule, QueueModule],
  controllers: [ProductsController, VolumePricingController, BundleController],
  providers: [ProductsService, ProductsBulkService, ProductsCacheHook, ProductViewSchedulerService, VolumePricingService],
  exports: [ProductsService, ProductsBulkService, ProductsCacheHook, VolumePricingService],
})
export class ProductsModule {}
