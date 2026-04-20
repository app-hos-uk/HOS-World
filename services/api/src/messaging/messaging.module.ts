import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TemplatesModule } from '../templates/templates.module';
import { MessagingService } from './messaging.service';
import { EmailSender } from './senders/email.sender';
import { SmsSender } from './senders/sms.sender';
import { WhatsAppSender } from './senders/whatsapp.sender';
import { PushSender } from './senders/push.sender';
import { InAppSender } from './senders/inapp.sender';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    TemplatesModule,
    NotificationsModule,
    WhatsAppModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'changeme'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  providers: [
    MessagingService,
    EmailSender,
    SmsSender,
    WhatsAppSender,
    PushSender,
    InAppSender,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
