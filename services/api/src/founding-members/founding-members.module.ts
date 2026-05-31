import { Module } from '@nestjs/common';
import { FoundingMembersController } from './founding-members.controller';
import { FoundingMembersService } from './founding-members.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FoundingMembersController],
  providers: [FoundingMembersService],
  exports: [FoundingMembersService],
})
export class FoundingMembersModule {}
