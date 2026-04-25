import { Module, forwardRef } from '@nestjs/common';
import { SocialSharingController } from './social-sharing.controller';
import { SocialSharingService } from './social-sharing.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [forwardRef(() => LoyaltyModule)],
  controllers: [SocialSharingController],
  providers: [SocialSharingService],
  exports: [SocialSharingService],
})
export class SocialSharingModule {}
