import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelSender, ChannelSenderParams, MessagingChannel, SendResult } from '../interfaces/channel-sender.interface';

@Injectable()
export class SmsSender implements ChannelSender {
  readonly channel: MessagingChannel = 'SMS';
  private readonly logger = new Logger(SmsSender.name);

  constructor(private config: ConfigService) {}

  async send(params: ChannelSenderParams): Promise<SendResult> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_SMS_NUMBER');
    if (!sid || !token || !from) {
      this.logger.debug(`SMS skipped (Twilio SMS not configured): to=${params.to}`);
      return { success: true, providerRef: 'skipped-no-config' };
    }
    try {
      const twilio = require('twilio');
      const client = twilio(sid, token);
      const msg = await client.messages.create({
        from,
        to: params.to.startsWith('+') ? params.to : `+${params.to.replace(/\D/g, '')}`,
        body: params.body,
      });
      return { success: true, providerRef: msg.sid };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
