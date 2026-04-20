import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { DatabaseModule } from '../database/database.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [DatabaseModule, ConfigModule, forwardRef(() => LoyaltyModule)],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
