import { Module, forwardRef } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { PublishingController } from './publishing.controller';
import { DatabaseModule } from '../database/database.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => ProductsModule)],
  controllers: [PublishingController],
  providers: [PublishingService],
  exports: [PublishingService],
})
export class PublishingModule {}

