import { Module, forwardRef } from '@nestjs/common';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';
import { DatabaseModule } from '../database/database.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => LoyaltyModule)],
  controllers: [QuestsController],
  providers: [QuestsService],
  exports: [QuestsService],
})
export class QuestsModule {}
