import { Module } from '@nestjs/common';
import { CreateTeamUsersController } from './create-team-users.controller';
import { AdminUsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CreateTeamUsersController, AdminUsersController],
})
export class AdminModule {}

