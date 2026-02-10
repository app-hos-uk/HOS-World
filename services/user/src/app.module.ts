import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { CustomerGroupsModule } from './customer-groups/customer-groups.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    DatabaseModule,
    UsersModule,
    AddressesModule,
    CustomerGroupsModule,
    HealthModule,
  ],
})
export class AppModule {}
