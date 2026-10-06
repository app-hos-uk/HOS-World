import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import type {
  ChannelSender,
  ChannelSenderParams,
  MessagingChannel,
  SendResult,
} from '../interfaces/channel-sender.interface';

@Injectable()
export class SmsSender implements ChannelSender {
  readonly channel: MessagingChannel = 'SMS';
  private readonly logger = new Logger(SmsSender.name);

  constructor(
    private config: ConfigService,
    @Optional() private integrationsService?: IntegrationsService,
  ) {}

  async send(params: ChannelSenderParams): Promise<SendResult> {
    let sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    let token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    let from = this.config.get<string>('TWILIO_SMS_NUMBER');

    if (params.marketId && this.integrationsService) {
      try {
        const row = await this.integrationsService.resolveIntegration(
          'SMS',
          'twilio',
          params.marketId,
        );
        if (row?.marketId === params.marketId && row.isActive) {
          const creds = await this.integrationsService.getDecryptedCredentials(row.id);
          const marketSid = creds.accountSid || creds.sid;
          const marketToken = creds.authToken || creds.token;
          const marketFrom = creds.fromNumber || creds.from;
          if (marketSid && marketToken && marketFrom) {
            sid = String(marketSid);
            token = String(marketToken);
            from = String(marketFrom);
          }
        }
      } catch (err) {
        this.logger.warn(
          `Market SMS config unavailable, using env Twilio: ${(err as Error).message}`,
        );
      }
    }

    if (!sid || !token || !from) {
      this.logger.debug(`SMS skipped (Twilio SMS not configured): to=${params.to}`);
      return { success: true, providerRef: 'skipped-no-config' };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
