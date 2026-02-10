import { DynamicModule, Global, Module, Logger } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { EventBusService } from './event-bus.service';

export const EVENT_BUS_CLIENT = 'EVENT_BUS_CLIENT';

export interface EventBusModuleOptions {
  /** Redis URL (e.g., redis://localhost:6379). Falls back to REDIS_URL env var. */
  redisUrl?: string;
  /** Service name used as source in events */
  serviceName: string;
}

/**
 * EventBusModule
 *
 * Provides a NestJS module that connects to Redis for pub/sub event-driven
 * communication between microservices. Import this module into any service
 * that needs to emit or consume domain events.
 *
 * Usage:
 *   EventBusModule.register({ serviceName: 'order-service' })
 */
@Global()
@Module({})
export class EventBusModule {
  static register(options: EventBusModuleOptions): DynamicModule {
    const redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    return {
      module: EventBusModule,
      imports: [
        ClientsModule.register([
          {
            name: EVENT_BUS_CLIENT,
            transport: Transport.REDIS,
            options: {
              host: new URL(redisUrl).hostname,
              port: parseInt(new URL(redisUrl).port || '6379', 10),
              password: new URL(redisUrl).password || undefined,
              retryAttempts: 5,
              retryDelay: 3000,
            },
          },
        ]),
      ],
      providers: [
        {
          provide: 'EVENT_BUS_SERVICE_NAME',
          useValue: options.serviceName,
        },
        EventBusService,
      ],
      exports: [EventBusService, ClientsModule],
    };
  }
}
