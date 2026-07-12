import { Module } from '@nestjs/common';
import { UniversesService } from './universes.service';
import { UniversesController } from './universes.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [UniversesController],
  providers: [UniversesService],
  exports: [UniversesService],
})
export class UniversesModule {}
