import { Module, forwardRef } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsBulkService } from './products-bulk.service';
import { ProductsElasticsearchHook } from './products-elasticsearch.hook';
import { VolumePricingService } from './volume-pricing.service';
import { VolumePricingController } from './volume-pricing.controller';
import { BundleController } from './bundle.controller';
import { SearchModule } from '../search/search.module';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [forwardRef(() => SearchModule), forwardRef(() => CacheModule), DatabaseModule],
  controllers: [ProductsController, VolumePricingController, BundleController],
  providers: [
    ProductsService,
    ProductsBulkService,
    ProductsElasticsearchHook,
    VolumePricingService,
  ],
  exports: [ProductsService, ProductsBulkService, ProductsElasticsearchHook, VolumePricingService],
})
export class ProductsModule {}
