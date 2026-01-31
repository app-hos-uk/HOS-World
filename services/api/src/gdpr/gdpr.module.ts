import { Module } from '@nestjs/common';
import { GDPRService } from './gdpr.service';
import { GDPRController } from './gdpr.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GDPRController],
  providers: [GDPRService],
  exports: [GDPRService],
})
export class GDPRModule {}
