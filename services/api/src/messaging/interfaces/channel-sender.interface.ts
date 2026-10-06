export interface SendResult {
  success: boolean;
  providerRef?: string;
  error?: string;
}

export type MessagingChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

export interface ChannelSenderParams {
  userId: string;
  to: string;
  subject?: string;
  body: string;
  templateSlug?: string;
  metadata?: Record<string, unknown>;
  /** When set, SMS uses the market Twilio integration before env credentials. */
  marketId?: string;
}

export interface ChannelSender {
  readonly channel: MessagingChannel;
  send(params: ChannelSenderParams): Promise<SendResult>;
}
