import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeilisearchService } from './meilisearch.service';
import { MeilisearchController } from './meilisearch.controller';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [MeilisearchController],
  providers: [MeilisearchService],
  exports: [MeilisearchService],
})
export class MeilisearchModule {}
