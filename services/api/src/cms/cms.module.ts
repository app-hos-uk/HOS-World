import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CMSController } from './cms.controller';
import { CMSService } from './cms.service';

@Module({
  imports: [ConfigModule],
  controllers: [CMSController],
  providers: [CMSService],
  exports: [CMSService],
})
export class CMSModule {}


