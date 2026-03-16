import { Module, forwardRef } from '@nestjs/common';
import { InfluencerInvitationsService } from './influencer-invitations.service';
import { InfluencerInvitationsController } from './influencer-invitations.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TemplatesModule } from '../templates/templates.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, TemplatesModule, forwardRef(() => AuthModule)],
  controllers: [InfluencerInvitationsController],
  providers: [InfluencerInvitationsService],
  exports: [InfluencerInvitationsService],
})
export class InfluencerInvitationsModule {}
