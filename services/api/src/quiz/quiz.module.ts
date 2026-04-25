import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { SegmentationModule } from '../segmentation/segmentation.module';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { QuizAdminController } from './quiz-admin.controller';

@Module({
  imports: [DatabaseModule, ConfigModule, forwardRef(() => LoyaltyModule), SegmentationModule],
  controllers: [QuizController, QuizAdminController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
