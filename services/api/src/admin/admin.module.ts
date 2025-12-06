import { Module } from '@nestjs/common';
import { CreateTeamUsersController } from './create-team-users.controller';
import { AdminUsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CreateTeamUsersController, AdminUsersController, AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

