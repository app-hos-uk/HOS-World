import { Module } from '@nestjs/common';
import { InfluencerInvitationsService } from './influencer-invitations.service';
import { InfluencerInvitationsController } from './influencer-invitations.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InfluencerInvitationsController],
  providers: [InfluencerInvitationsService],
  exports: [InfluencerInvitationsService],
})
export class InfluencerInvitationsModule {}
