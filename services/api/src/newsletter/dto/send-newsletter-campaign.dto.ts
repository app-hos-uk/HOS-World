import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendNewsletterCampaignDto {
  @IsString()
  @MinLength(1)
  subject: string;

  /** HTML email body */
  @IsString()
  @MinLength(1)
  body: string;

  /** When set with tagValue, only subscribers whose tags JSON includes this key/value are emailed */
  @IsOptional()
  @IsString()
  tagKey?: string;

  @IsOptional()
  @IsString()
  tagValue?: string;
}
