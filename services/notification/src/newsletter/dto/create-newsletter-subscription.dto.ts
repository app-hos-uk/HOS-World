import { IsEmail, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateNewsletterSubscriptionDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  source?: string; // 'website', 'checkout', 'api'

  @IsOptional()
  @IsObject()
  tags?: Record<string, string>; // For segmentation
}
