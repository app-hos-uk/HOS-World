import { Module, forwardRef } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsBulkService } from './products-bulk.service';
import { ProductsElasticsearchHook } from './products-elasticsearch.hook';
import { SearchModule } from '../search/search.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [forwardRef(() => SearchModule), forwardRef(() => CacheModule)],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsBulkService, ProductsElasticsearchHook],
  exports: [ProductsService, ProductsBulkService, ProductsElasticsearchHook],
})
export class ProductsModule {}
