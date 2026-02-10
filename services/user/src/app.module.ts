import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { CustomerGroupsModule } from './customer-groups/customer-groups.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true' }),
    ObservabilityModule.register({ serviceName: 'user-service' }),
    EventBusModule.register({ serviceName: 'user-service', redisUrl: process.env.REDIS_URL }),
    DatabaseModule,
    UsersModule,
    AddressesModule,
    CustomerGroupsModule,
    HealthModule,
  ],
})
export class AppModule {}
