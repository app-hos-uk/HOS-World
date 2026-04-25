import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import type { ChannelSender, ChannelSenderParams, MessagingChannel, SendResult } from '../interfaces/channel-sender.interface';

@Injectable()
export class PushSender implements ChannelSender {
  readonly channel: MessagingChannel = 'PUSH';
  private readonly logger = new Logger(PushSender.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async send(params: ChannelSenderParams): Promise<SendResult> {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: params.userId, isActive: true },
      take: 5,
    });
    if (subs.length === 0) {
      this.logger.debug(`Push: no subscriptions for user ${params.userId}`);
      return { success: true, providerRef: 'skipped-no-subscription' };
    }

    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      this.logger.debug('Push: VAPID keys not configured');
      return { success: true, providerRef: 'skipped-no-vapid' };
    }

    try {
      const webpush = await import('web-push');
      webpush.setVapidDetails(
        this.config.get<string>('VAPID_SUBJECT') || 'mailto:hello@houseofspells.co.uk',
        publicKey,
        privateKey,
      );
      let lastId = '';
      for (const sub of subs) {
        const keys = sub.keys as { p256dh?: string; auth?: string };
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: keys.p256dh || '', auth: keys.auth || '' },
          },
          JSON.stringify({
            title: params.subject || 'House of Spells',
            body: params.body.replace(/<[^>]+>/g, '').slice(0, 500),
          }),
        );
        lastId = sub.id;
      }
      return { success: true, providerRef: lastId };
    } catch (e) {
      this.logger.warn(`Push send failed: ${(e as Error).message}`);
      return { success: false, error: (e as Error).message };
    }
  }
}
