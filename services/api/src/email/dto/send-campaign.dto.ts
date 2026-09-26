import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AudienceFiltersDto } from './resolve-audience.dto';

export class SendCampaignDto {
  @IsIn(['INDIVIDUAL', 'SEGMENT', 'ALL'])
  audienceType: 'INDIVIDUAL' | 'SEGMENT' | 'ALL';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFiltersDto)
  filters?: AudienceFiltersDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateSlug?: string;

  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  @MaxLength(200000)
  bodyHtml: string;

  /** Omitted / true = dry run. Live send requires dryRun: false. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;
}
