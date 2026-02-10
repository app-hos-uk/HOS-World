import { Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [TaxonomyController],
})
export class TaxonomyModule {}
