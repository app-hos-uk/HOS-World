import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../../notifications/notifications.service';
import type { ChannelSender, ChannelSenderParams, MessagingChannel, SendResult } from '../interfaces/channel-sender.interface';

@Injectable()
export class EmailSender implements ChannelSender {
  readonly channel: MessagingChannel = 'EMAIL';

  constructor(private notifications: NotificationsService) {}

  async send(params: ChannelSenderParams): Promise<SendResult> {
    try {
      await this.notifications.queueNotification(params.to, params.subject || 'House of Spells', params.body);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
