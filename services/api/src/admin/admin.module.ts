import { Module } from '@nestjs/common';
import { CreateTeamUsersController } from './create-team-users.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CreateTeamUsersController],
})
export class AdminModule {}

