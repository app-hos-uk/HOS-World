import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { NotificationModule } from './notification/notification.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { HealthModule } from './health/health.module';

/**
 * Notification Microservice - App Module
 *
 * This microservice handles all notification-related concerns:
 * - In-app notifications (CRUD + event-driven creation)
 * - Email sending (SMTP via nodemailer)
 * - WhatsApp messaging (Twilio integration)
 * - Newsletter subscriptions
 *
 * It connects to the same PostgreSQL database as the monolith during
 * the migration period, using its own Prisma client generated from
 * a focused schema that covers only notification-related tables.
 *
 * It also connects to Redis as a microservice transport to listen
 * for domain events (order created, payment completed, etc.) and
 * react by sending notifications.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true'
          ? undefined
          : '.env',
      ignoreEnvFile:
        process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true',
    }),
    ObservabilityModule.register({ serviceName: 'notification-service' }),
    EventBusModule.register({ serviceName: 'notification-service', redisUrl: process.env.REDIS_URL }),

    // Core
    DatabaseModule,
    EmailModule,

    // Feature modules
    NotificationModule,
    WhatsAppModule,
    NewsletterModule,

    // Infra
    HealthModule,
  ],
})
export class AppModule {}
