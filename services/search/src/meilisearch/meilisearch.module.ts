import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeilisearchService } from './meilisearch.service';
import { MeilisearchController } from './meilisearch.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MeilisearchController],
  providers: [MeilisearchService],
  exports: [MeilisearchService],
})
export class MeilisearchModule {}
