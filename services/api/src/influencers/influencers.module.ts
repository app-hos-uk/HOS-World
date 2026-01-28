import { Module } from '@nestjs/common';
import { InfluencersService } from './influencers.service';
import { InfluencersController } from './influencers.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InfluencersController],
  providers: [InfluencersService],
  exports: [InfluencersService],
})
export class InfluencersModule {}
