import { Module } from '@nestjs/common';
import { SocialSharingController } from './social-sharing.controller';
import { SocialSharingService } from './social-sharing.service';

@Module({
  controllers: [SocialSharingController],
  providers: [SocialSharingService],
  exports: [SocialSharingService],
})
export class SocialSharingModule {}
