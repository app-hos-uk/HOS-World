import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { ChannelSender, ChannelSenderParams, MessagingChannel, SendResult } from '../interfaces/channel-sender.interface';

@Injectable()
export class InAppSender implements ChannelSender {
  readonly channel: MessagingChannel = 'IN_APP';

  constructor(private prisma: PrismaService) {}

  async send(params: ChannelSenderParams): Promise<SendResult> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      });
      await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: 'GENERAL' as any,
          subject: params.subject || 'Notification',
          content: params.body,
          email: user?.email,
          status: 'PENDING' as any,
          metadata: { templateSlug: params.templateSlug, channel: 'IN_APP' } as any,
        },
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
