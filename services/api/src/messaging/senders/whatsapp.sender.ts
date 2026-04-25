import { Injectable } from '@nestjs/common';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import type { ChannelSender, ChannelSenderParams, MessagingChannel, SendResult } from '../interfaces/channel-sender.interface';

@Injectable()
export class WhatsAppSender implements ChannelSender {
  readonly channel: MessagingChannel = 'WHATSAPP';

  constructor(private whatsapp: WhatsAppService) {}

  async send(params: ChannelSenderParams): Promise<SendResult> {
    try {
      const res = await this.whatsapp.sendMessage({
        to: params.to.replace(/^whatsapp:/, ''),
        message: params.body,
        userId: params.userId,
      });
      const ok = (res as { status?: string }).status !== 'FAILED';
      return { success: ok, providerRef: (res as { messageId?: string }).messageId };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
