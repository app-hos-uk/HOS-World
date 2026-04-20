import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import type { MessagingChannel, SendResult } from './interfaces/channel-sender.interface';
import { EmailSender } from './senders/email.sender';
import { SmsSender } from './senders/sms.sender';
import { WhatsAppSender } from './senders/whatsapp.sender';
import { PushSender } from './senders/push.sender';
import { InAppSender } from './senders/inapp.sender';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private prisma: PrismaService,
    private templates: TemplatesService,
    private config: ConfigService,
    private jwt: JwtService,
    private emailSender: EmailSender,
    private smsSender: SmsSender,
    private whatsappSender: WhatsAppSender,
    private pushSender: PushSender,
    private inAppSender: InAppSender,
  ) {}

  generateUnsubscribeToken(userId: string, channel: MessagingChannel): string {
    return this.jwt.sign({ sub: userId, channel, typ: 'm_unsub' }, { expiresIn: '90d' });
  }

  private buildUnsubscribeUrl(userId: string, channel: MessagingChannel): string {
    const token = this.generateUnsubscribeToken(userId, channel);
    const base = this.config.get<string>('APP_URL', 'https://houseofspells.co.uk');
    return `${base}/unsubscribe?token=${token}`;
  }

  private senderFor(ch: MessagingChannel) {
    switch (ch) {
      case 'EMAIL':
        return this.emailSender;
      case 'SMS':
        return this.smsSender;
      case 'WHATSAPP':
        return this.whatsappSender;
      case 'PUSH':
        return this.pushSender;
      case 'IN_APP':
        return this.inAppSender;
      default:
        return this.emailSender;
    }
  }

  /** Marketing consent + per-channel loyalty opt-in. IN_APP bypasses marketing check per spec. */
  async canSendMarketing(userId: string, channel: MessagingChannel): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        gdprConsent: true,
        dataProcessingConsent: true,
        email: true,
        whatsappNumber: true,
        phone: true,
      },
    });
    if (!user) return false;
    if (channel === 'IN_APP') return true;
    if (!user.gdprConsent) return false;
    const dp = (user.dataProcessingConsent || {}) as Record<string, boolean>;
    if (dp.marketing === false) return false;

    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      select: { optInEmail: true, optInSms: true, optInWhatsApp: true, optInPush: true },
    });
    if (channel === 'EMAIL' && m && m.optInEmail === false) return false;
    if (channel === 'SMS' && m && m.optInSms === false) return false;
    if (channel === 'WHATSAPP' && m && m.optInWhatsApp === false) return false;
    if (channel === 'PUSH' && m && m.optInPush === false) return false;

    if (channel === 'EMAIL') {
      const sub = await this.prisma.newsletterSubscription.findFirst({
        where: { email: user.email || '', status: 'unsubscribed' },
      });
      if (sub) return false;
    }
    return true;
  }

  private resolvePreferredChannel(pref: string | null | undefined): MessagingChannel {
    const p = (pref || 'EMAIL').toUpperCase();
    if (p.includes('WHATSAPP') || p === 'WHATSAPP') return 'WHATSAPP';
    if (p === 'SMS' || p === 'PHONE') return 'SMS';
    if (p === 'PUSH') return 'PUSH';
    if (p === 'IN_APP' || p === 'IN_APP_NOTIFICATION') return 'IN_APP';
    return 'EMAIL';
  }

  async send(params: {
    userId: string;
    channel?: string;
    templateSlug: string;
    templateVars: Record<string, string>;
    subject?: string;
    journeyId?: string;
    enrollmentId?: string;
  }): Promise<SendResult> {
    let channel: MessagingChannel;
    if (!params.channel || params.channel === 'USER_PREFERRED') {
      const u = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { preferredCommunicationMethod: true, email: true },
      });
      channel = this.resolvePreferredChannel(u?.preferredCommunicationMethod);
    } else {
      channel = params.channel.toUpperCase() as MessagingChannel;
    }

    const vars = {
      ...params.templateVars,
      unsubscribeUrl: this.buildUnsubscribeUrl(params.userId, channel),
    };

    const log = await this.prisma.messageLog.create({
      data: {
        userId: params.userId,
        channel,
        templateSlug: params.templateSlug,
        subject: params.subject,
        status: 'QUEUED',
        journeyId: params.journeyId,
        enrollmentId: params.enrollmentId,
        metadata: { vars } as object,
      },
    });

    const allowed = await this.canSendMarketing(params.userId, channel);
    if (!allowed) {
      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: { status: 'SKIPPED_CONSENT', error: 'Consent or opt-in' },
      });
      return { success: false, error: 'SKIPPED_CONSENT' };
    }

    let rendered: { subject: string; body: string };
    try {
      rendered = await this.templates.render(params.templateSlug, vars);
    } catch (e) {
      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: `Template error: ${(e as Error).message}` },
      });
      return { success: false, error: `Template error: ${(e as Error).message}` };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, phone: true, whatsappNumber: true },
    });
    if (!user) {
      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: 'User not found' },
      });
      return { success: false, error: 'User not found' };
    }

    if (!user.email && channel === 'EMAIL') {
      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: 'No email' },
      });
      return { success: false, error: 'No email' };
    }

    let to = '';
    if (channel === 'EMAIL') to = user.email || '';
    else if (channel === 'SMS') to = user.phone || '';
    else if (channel === 'WHATSAPP') to = user.whatsappNumber || user.phone || '';
    else if (channel === 'PUSH' || channel === 'IN_APP') to = params.userId;

    if (channel !== 'EMAIL' && channel !== 'IN_APP' && channel !== 'PUSH' && !to) {
      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: 'No destination' },
      });
      return { success: false, error: 'No destination' };
    }

    const sender = this.senderFor(channel);
    const body = rendered.body;
    const subject = params.subject || rendered.subject || 'House of Spells';

    try {
      const result = await sender.send({
        userId: params.userId,
        to,
        subject,
        body,
        templateSlug: params.templateSlug,
      });

      const skipped = result.providerRef?.startsWith('skipped-');
      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? (skipped ? 'SKIPPED_NO_CONFIG' : 'SENT') : 'FAILED',
          error: result.error,
          providerRef: result.providerRef,
          sentAt: result.success && !skipped ? new Date() : undefined,
          subject,
        },
      });
      return result;
    } catch (e) {
      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: (e as Error).message },
      });
      return { success: false, error: (e as Error).message };
    }
  }

  async sendMultiChannel(params: {
    userId: string;
    channels: string[];
    templateSlug: string;
    templateVars: Record<string, string>;
    subject?: string;
    journeyId?: string;
    enrollmentId?: string;
  }): Promise<SendResult[]> {
    const out: SendResult[] = [];
    for (const ch of params.channels) {
      out.push(
        await this.send({
          userId: params.userId,
          channel: ch,
          templateSlug: params.templateSlug,
          templateVars: params.templateVars,
          subject: params.subject,
          journeyId: params.journeyId,
          enrollmentId: params.enrollmentId,
        }),
      );
    }
    return out;
  }
}
