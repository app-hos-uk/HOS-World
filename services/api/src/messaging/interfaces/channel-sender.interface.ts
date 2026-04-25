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
}

export interface ChannelSender {
  readonly channel: MessagingChannel;
  send(params: ChannelSenderParams): Promise<SendResult>;
}
