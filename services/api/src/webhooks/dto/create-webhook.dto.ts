import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[]; // Array of event types to subscribe to

  @IsOptional()
  @IsString()
  secret?: string; // Webhook secret for signature verification

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  sellerId?: string; // If null, platform-wide webhook
}
