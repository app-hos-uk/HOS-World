import { DynamicModule, Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventBusService } from './event-bus.service';
import { EventBusNoOpService } from './event-bus-noop.service';

export const EVENT_BUS_CLIENT = 'EVENT_BUS_CLIENT';

export interface EventBusModuleOptions {
  /** Redis URL (e.g., redis://localhost:6379). Falls back to REDIS_URL env var. If missing, a no-op implementation is used. */
  redisUrl?: string;
  /** Service name used as source in events */
  serviceName: string;
}

function getEffectiveRedisUrl(options: EventBusModuleOptions): string | undefined {
  // Use Redis only when explicitly enabled (EVENT_BUS_USE_REDIS=true) and REDIS_URL is set.
  // Otherwise use no-op so services start reliably; Redis client registration can fail in some builds.
  if (process.env.EVENT_BUS_USE_REDIS !== 'true') return undefined;
  const raw = options.redisUrl ?? process.env.REDIS_URL;
  const url = (typeof raw === 'string' ? raw : '').trim();
  if (!url) return undefined;
  try {
    new URL(url);
    return url;
  } catch {
    return undefined;
  }
}

/**
 * EventBusModule
 *
 * Provides a NestJS module that connects to Redis for pub/sub event-driven
 * communication between microservices. When REDIS_URL is not set or invalid,
 * a no-op implementation is used so services can start without Redis.
 *
 * Usage:
 *   EventBusModule.register({ serviceName: 'order-service' })
 */
@Global()
@Module({})
export class EventBusModule {
  static register(options: EventBusModuleOptions): DynamicModule {
    const redisUrl = getEffectiveRedisUrl(options);

    if (!redisUrl) {
      return {
        module: EventBusModule,
        providers: [
          { provide: 'EVENT_BUS_SERVICE_NAME', useValue: options.serviceName },
          { provide: EventBusService, useClass: EventBusNoOpService },
        ],
        exports: [EventBusService],
      };
    }

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
        { provide: 'EVENT_BUS_SERVICE_NAME', useValue: options.serviceName },
        EventBusService,
      ],
      exports: [EventBusService, ClientsModule],
    };
  }
}
